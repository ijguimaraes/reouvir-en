"""Grava as frases de uma playlist, num contexto, direto no Postgres.

Uso:
  python write_db.py --playlist <slug> --context ../contexts/<x>.yaml --input final.json \
      [--dry-run] [--replace] [--allow-published] [--words MIN-MAX] [--prompt-version v1] [--model <id>]

A playlist é identificada por (slug do contexto, slug da playlist) e PRECISA EXISTIR: contextos e playlists são
criados no backoffice. O contexto vem do `slug` do arquivo --context (que também traz as cenas, usadas na ordem).

Conexão: PIPELINE_DATABASE_URL (variável de ambiente ou PIPELINE_DATA_DIR/pipeline-db.env, criado por
create_pipeline_role.py). Use a role da pipeline, não a do administrador.

O que faz, numa única transação:
  1. Acha a playlist. Recusa se o contexto ou a playlist não existem.
  2. Proteções: recusa playlist publicada (sem --allow-published) e playlist com frases (sem --replace).
  3. Diff por hash do texto normalizado: remove as frases que saíram, renumera as que ficaram e insere as
     novas. Frases iguais mantêm o mesmo id (e, portanto, o áudio já gerado).
  4. Confere o resultado no próprio banco (posições, textos, hashes) antes de confirmar.
  --dry-run executa tudo isso e DESFAZ no fim: mostra exatamente o que aconteceria, inclusive os
  erros que só o banco detectaria.

Não calcula text_hash, char_count nem version (triggers do banco) e não mexe em status, título nem posição.
"""
import argparse
import json
import sys
from pathlib import Path

import psycopg
import yaml

import balance
from dbconn import connection_url
from validate import normalize_text, text_errors, text_hash
from vocab import data_dir


class Refusal(Exception):
    """Recusa esperada: a mensagem diz ao usuário o que fazer."""


def build_rows(items, scene_ids, structure_ids, prompt_version, model, word_range=(0, 10**6)):
    """Normaliza, recusa texto inválido e duplicatas, ordena por cena e monta as linhas (position, text, hash, metadata).

    O gravador é a última linha de defesa: não confia que o arquivo passou pelo validate.py. Aplica as regras de
    texto (URL, emoji, dígito, caractere invisível ou não-ASCII, pontuação final e, se informada, a faixa de palavras).
    A gramática e o vocabulário continuam sendo do validate.py."""
    seen, norm, bad = {}, [], []
    for x in items:
        raw = x["text"] if isinstance(x, dict) else x
        text = normalize_text(raw)
        h = text_hash(text)
        errs, _ = text_errors(text, *word_range)
        if errs:
            bad.append(f"{text!r}: {'; '.join(errs)}")
            continue
        if h in seen:
            raise Refusal(f"frase repetida no arquivo de entrada (depois de normalizada): {text!r}")
        seen[h] = text
        d = dict(x) if isinstance(x, dict) else {}
        d["text"] = text
        d["claimed"] = d.get("claimed") or d.get("structure")
        norm.append(d)
    if bad:
        raise Refusal(f"{len(bad)} frase(s) do arquivo quebram as regras de texto (passe por validate.py):\n  - "
                      + "\n  - ".join(bad[:5]) + ("\n  ..." if len(bad) > 5 else ""))
    rows = []
    for pos, x in enumerate(balance.order_playlist(norm, scene_ids, structure_ids), start=1):
        meta = {"origin": "pipeline", "prompt_version": prompt_version}
        if x.get("scene"): meta["scene"] = x["scene"]
        if x.get("claimed"): meta["structure"] = x["claimed"]
        if model: meta["model"] = model
        if x.get("vocab"): meta["vocab_flags"] = sorted({v[0] for v in x["vocab"]})
        rows.append({"position": pos, "text": x["text"], "hash": text_hash(x["text"]), "metadata": meta})
    return rows


def _same_meta(a, b):
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def apply(conn, playlist_slug, context, rows, *, replace, allow_published):
    """Roda a gravação dentro da transação aberta. Devolve o relatório."""
    cur = conn.cursor()
    rep = {"actions": [], "warnings": []}

    # 1) contexto e playlist --------------------------------------------------------------------
    cx = cur.execute("SELECT id FROM contexts WHERE slug = %s", (context["slug"],)).fetchone()
    if cx is None:
        raise Refusal(f"o contexto {context['slug']!r} não existe no banco. Crie-o no backoffice e rode de novo.")
    pl = cur.execute("SELECT id, status, version FROM playlists WHERE context_id = %s AND slug = %s",
                     (cx[0], playlist_slug)).fetchone()
    if pl is None:
        raise Refusal(f"a playlist {playlist_slug!r} não existe no contexto {context['slug']!r}. "
                      "Crie-a no backoffice (Contextos > Playlists) e rode de novo.")
    pl_id, status, version_before = pl
    rep.update(playlist_id=str(pl_id), status=status, version_before=version_before)

    # 2) diff por hash ------------------------------------------------------------------------------
    cur_rows = cur.execute("SELECT id, position, text_hash, metadata FROM sentences WHERE playlist_id = %s ORDER BY position",
                           (pl_id,)).fetchall()
    by_hash = {r[2]: r for r in cur_rows}
    new_hashes = {r["hash"] for r in rows}
    removed = [r for r in cur_rows if r[2] not in new_hashes]
    added = [r for r in rows if r["hash"] not in by_hash]
    moved = [(by_hash[r["hash"]][0], r) for r in rows if r["hash"] in by_hash
             and (by_hash[r["hash"]][1] != r["position"] or not _same_meta(by_hash[r["hash"]][3], r["metadata"]))]
    kept = len(rows) - len(added)
    rep.update(existing=len(cur_rows), kept=kept, added=len(added), removed=len(removed), moved=len(moved))
    changes = bool(added or removed or moved)

    if changes and status == "published" and not allow_published:
        raise Refusal("a playlist está PUBLICADA: trocar as frases vale na hora para os alunos e zera o ponto onde cada "
                      "aluno parou nas frases removidas. Use --allow-published se é isso mesmo que você quer.")
    if changes and cur_rows and not replace:
        raise Refusal(f"a playlist já tem {len(cur_rows)} frases. Use --replace para substituir "
                      f"(+{len(added)} novas, -{len(removed)} removidas, {len(moved)} reordenadas/atualizadas).")

    # 3) aplica (UNIQUE de position é DEFERRABLE: a renumeração cabe na transação) ----------------
    if removed:
        cur.execute("DELETE FROM sentences WHERE id = ANY(%s)", ([r[0] for r in removed],))
    if moved:
        cur.execute("UPDATE sentences s SET position = v.p, metadata = v.m::jsonb "
                    "FROM unnest(%s::uuid[], %s::int[], %s::text[]) AS v(id, p, m) WHERE s.id = v.id",
                    ([m[0] for m in moved], [m[1]["position"] for m in moved], [json.dumps(m[1]["metadata"]) for m in moved]))
    if added:
        cur.execute("INSERT INTO sentences (playlist_id, position, text, metadata) "
                    "SELECT %s, v.p, v.t, v.m::jsonb FROM unnest(%s::int[], %s::text[], %s::text[]) AS v(p, t, m)",
                    (pl_id, [r["position"] for r in added], [r["text"] for r in added],
                     [json.dumps(r["metadata"]) for r in added]))

    # 4) confere no banco, antes de confirmar --------------------------------------------------------
    got = cur.execute("SELECT position, text, text_hash FROM sentences WHERE playlist_id = %s ORDER BY position", (pl_id,)).fetchall()
    want = [(r["position"], r["text"], r["hash"]) for r in rows]
    if got != want:
        bad = next((i for i, (g, w) in enumerate(zip(got, want)) if g != w), min(len(got), len(want)))
        raise RuntimeError(f"o banco não ficou como o esperado (primeira diferença na posição {bad + 1}; "
                           f"banco: {len(got)} frases, esperado: {len(want)}). Nada foi gravado.")
    rep["version_after"] = cur.execute("SELECT version FROM playlists WHERE id = %s", (pl_id,)).fetchone()[0]
    return rep


def run(url, playlist_slug, context, items, *, dry_run=False, replace=False, allow_published=False,
        prompt_version="v1", model=None, word_range=None):
    if not items:
        raise Refusal("nenhuma frase para gravar")
    scene_ids = [s["id"] for s in context.get("scenes", [])]
    # Sem currículo, a ordem das estruturas dentro de cada cena é a da primeira aparição no arquivo de entrada.
    structure_ids = list(dict.fromkeys(
        x.get("claimed") or x.get("structure") for x in items if isinstance(x, dict) and (x.get("claimed") or x.get("structure"))))
    rows = build_rows(items, scene_ids, structure_ids, prompt_version, model, word_range or (0, 10**6))
    with psycopg.connect(url) as conn:
        try:
            rep = apply(conn, playlist_slug, context, rows, replace=replace, allow_published=allow_published)
        except BaseException:
            conn.rollback()
            raise
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    rep.update(dry_run=dry_run, playlist=playlist_slug, context=context["slug"], total=len(rows))
    return rep


def print_report(r):
    tag = "[DRY RUN, nada foi gravado] " if r["dry_run"] else ""
    print(f"{tag}{r['context']} / {r['playlist']}  (playlist {r['status']}, versão {r['version_before']} -> {r['version_after']})")
    print(f"  frases: {r['total']} no total | {r['kept']} mantidas (áudio reaproveitado), {r['added']} novas "
          f"(áudio gerado na primeira escuta), {r['removed']} removidas (áudio fica sem uso), {r['moved']} reordenadas/atualizadas")
    if not (r["added"] or r["removed"] or r["moved"]):
        print("  sem mudanças: nada a fazer")
    for w in r["warnings"]:
        print("  AVISO:", w)


def parse_words(text):
    """'4-10' -> (4, 10); sem valor, sem faixa."""
    if not text:
        return None
    try:
        lo, hi = (int(x) for x in text.split("-"))
    except ValueError:
        raise SystemExit(f"--words precisa ser MIN-MAX, por exemplo 4-10 (recebi {text!r})")
    if not 0 < lo <= hi:
        raise SystemExit(f"--words inválido: {text!r}")
    return lo, hi


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--playlist", required=True, help="slug da playlist, dentro do contexto")
    ap.add_argument("--context", required=True, help="arquivo contexts/*.yaml (o slug dele é o do contexto no banco)")
    ap.add_argument("--input", required=True, help='JSON {"sentences": [...]} (saída de select_final.py)')
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--replace", action="store_true")
    ap.add_argument("--allow-published", action="store_true")
    ap.add_argument("--words", help="faixa de palavras por frase, ex.: 4-10 (opcional; sem ela só vale o texto limpo)")
    ap.add_argument("--prompt-version", default="v1")
    ap.add_argument("--model")
    a = ap.parse_args(argv)
    url = connection_url()
    if not url:
        sys.exit("sem conexão: defina PIPELINE_DATABASE_URL ou rode create_pipeline_role.py")
    context = yaml.safe_load(Path(a.context).read_text())
    data = json.loads(Path(a.input).read_text())
    items = data["sentences"] if isinstance(data, dict) else data
    try:
        rep = run(url, a.playlist, context, items, dry_run=a.dry_run, replace=a.replace, allow_published=a.allow_published,
                  prompt_version=a.prompt_version, model=a.model, word_range=parse_words(a.words))
    except Refusal as e:
        print("RECUSADO:", e)
        return 2
    print_report(rep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
