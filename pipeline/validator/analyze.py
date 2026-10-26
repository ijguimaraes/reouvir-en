"""Analisa os currículos: estruturas por tópico, ordem gramatical e cobertura do detector.

Uso: python analyze.py <pasta com features.yaml e curriculum-*.yaml> [relatorio.md]
"""
import sys
from pathlib import Path

import spacy
import yaml

from rules import detect, feature_refs

LEVELS = ["a1", "a2", "b1", "b2"]
WORDS = {"A1": (4, 10), "A2": (4, 10), "B1": (8, 18), "B2": (8, 18)}


def main(folder, report=None):
    folder = Path(folder)
    nlp = spacy.load("en_core_web_sm")
    feats = yaml.safe_load((folder / "features.yaml").read_text())["features"]

    topics, problems = [], []
    for lv in LEVELS:
        f = folder / f"curriculum-{lv}.yaml"
        if not f.exists():
            continue
        data = yaml.safe_load(f.read_text())
        code = data["level"]["code"]
        orders = [t["order"] for t in data["topics"]]
        if orders != list(range(1, len(orders) + 1)):
            problems.append(f"{code}: orders não sequenciais {orders}")
        for t in data["topics"]:
            t["level"] = code
            topics.append(t)

    slugs = [t["slug"] for t in topics]
    for s in {s for s in slugs if slugs.count(s) > 1}:
        problems.append(f"slug repetido: {s}")
    introduced = {}
    for t in topics:
        for fid in t.get("introduces", []):
            if fid not in feats:
                problems.append(f"{t['slug']}: feature inexistente {fid}")
            if fid in introduced:
                problems.append(f"feature {fid} introduzida duas vezes ({introduced[fid]} e {t['slug']})")
            introduced[fid] = t["slug"]
        if t.get("deepens") and t["deepens"] not in slugs:
            problems.append(f"{t['slug']}: deepens aponta para slug inexistente")
    for fid in feats:
        if fid not in introduced:
            problems.append(f"feature {fid} nunca é introduzida")

    allowed, rows, details, docs = set(), [], [], []
    for t in topics:
        earlier = set(allowed)
        allowed |= set(t.get("introduces", []))
        new = set(t.get("introduces", []))
        lo, hi = WORDS[t["level"]]
        n_new = n_mix = n_rev = n_ok = 0
        lines, issues = [], []
        for st in t.get("structures", []):
            doc = nlp(st["ex"])
            trig = {fid for fid, spec in feats.items() if detect(doc, spec, feats)}
            own = detect(doc, st["rule"], feats)
            viol = sorted(trig - allowed)
            is_new = bool(trig & new)
            mixed = is_new and bool(trig & earlier)
            n_new += is_new and not mixed
            n_mix += mixed
            n_rev += not is_new
            docs.append((t["slug"], st["id"], doc, st["rule"]))
            n_ok += own
            nw = len(st["ex"].split())
            flag = []
            if not own: flag.append("regra não detecta o próprio exemplo")
            if viol: flag.append("gramática posterior: " + ", ".join(viol))
            if not lo <= nw <= hi: flag.append(f"{nw} palavras (faixa {lo}–{hi})")
            tipo = ("novo+anterior" if mixed else "novo") if is_new else "revisão"
            lines.append(f"- {'✔' if not flag else '✘'} `{st['id']}` ({tipo}) “{st['ex']}”" + (f" — {'; '.join(flag)}" if flag else ""))
            if flag:
                issues.append(f"{t['level']} {t['slug']} / {st['id']}: {'; '.join(flag)}")
        n = len(t.get("structures", []))
        rows.append((t["level"], t["order"], t["slug"], n, n_new, n_mix, n_rev, n_ok, len(issues)))
        details.append((t, lines, issues))

    print(f"{'nível':5} {'#':>2} {'tópico':44} {'estr':>4} {'só novo':>7} {'novo+ant':>8} {'rev.':>4} {'ok':>3} {'erros':>5}")
    for r in rows:
        print(f"{r[0]:5} {r[1]:>2} {r[2]:44} {r[3]:>4} {r[4]:>7} {r[5]:>8} {r[6]:>4} {r[7]:>3} {r[8]:>5}")
    tot = [sum(r[i] for r in rows) for i in (3, 4, 5, 6, 7, 8)]
    print(f"TOTAL estruturas={tot[0]} só-novo={tot[1]} novo+anterior={tot[2]} revisão={tot[3]} detectadas={tot[4]} com erro={tot[5]}")

    # Regras largas: quantos exemplos de OUTROS tópicos cada regra detecta.
    wide = []
    for slug, sid, _, rule in docs:
        hits = sum(1 for s2, _, d2, _ in docs if s2 != slug and detect(d2, rule, feats))
        wide.append((hits / max(1, sum(1 for s2, *_ in docs if s2 != slug)), slug, sid, hits))
    wide.sort(reverse=True)
    wide = [w for w in wide if w[0] >= 0.10]
    for ratio, slug, sid, hits in wide:
        print(f"REGRA LARGA: {slug}/{sid} detecta {hits} exemplos de outros tópicos ({ratio:.0%})")
    for p in problems:
        print("PROBLEMA:", p)
    for _, _, iss in details:
        for i in iss:
            print("ERRO:", i)

    if report:
        out = ["# Análise das estruturas por tópico", "",
               "Gerado por `pipeline/validator/analyze.py` (spaCy `en_core_web_sm`). Não edite à mão.", "",
               "Cada estrutura tem uma regra spaCy e uma frase de exemplo. O exemplo precisa: ser detectado pela própria regra, "
               "caber na faixa de palavras do nível e não conter nenhuma feature introduzida em tópico posterior. "
               "**novo** = o exemplo usa uma feature introduzida no próprio tópico; **revisão** = só usa o que já foi ensinado.", ""]
        out += ["| Nível | # | Tópico | Estruturas | Frases por estrutura (100) | Só novo | Novo + anterior | Revisão | Detectadas | Com erro |", "|---|---|---|---|---|---|---|---|---|---|"]
        out += [f"| {r[0]} | {r[1]} | `{r[2]}` | {r[3]} | ~{100 / r[3]:.0f} | {r[4]} | {r[5]} | {r[6]} | {r[7]} | {r[8]} |" for r in rows]
        out += [f"| | | **Total** | **{tot[0]}** | | **{tot[1]}** | **{tot[2]}** | **{tot[3]}** | **{tot[4]}** | **{tot[5]}** |", ""]
        out += ["**Só novo** = o exemplo usa o recurso do tópico e nada de tópicos anteriores. **Novo + anterior** = combina o recurso novo com algo já ensinado (incremental). **Revisão** = só usa o que já foi ensinado.", ""]
        if wide:
            out += ["## Regras largas (detectam ≥10% dos exemplos de outros tópicos)", "",
                    "Regras largas não distinguem bem a estrutura. Servem para contagem de cobertura, mas não para provar que a frase é *daquela* estrutura.", ""]
            out += [f"- `{sl}/{si}`: {h} exemplos de outros tópicos ({r:.0%})" for r, sl, si, h in wide] + [""]
        if problems:
            out += ["## Problemas estruturais", ""] + [f"- {p}" for p in problems] + [""]
        for t, lines, _ in details:
            out += [f"## {t['level']} · {t['order']}. {t['name']} (`{t['slug']}`)", ""]
            if t.get("deepens"): out += [f"Aprofunda `{t['deepens']}`.", ""]
            out += lines + [""]
        Path(report).write_text("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
