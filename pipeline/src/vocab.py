"""Filtro de vocabulário por nível CEFR (só avisa, não rejeita).

A lista CEFR (CEFR-J) é geral e fica FORA do repositório, em PIPELINE_DATA_DIR/cefrj/lemmas.json
(gerada por fetch_cefrj.py). Tudo o que é específico de um tema vem do contexto, nunca do código:

  vocabulary:                        # em contexts/*.yaml
    - Java                           # texto simples: liberado em qualquer nível
    - { word: database, from: A2 }   # liberado a partir do A2; abaixo disso vira aviso

Palavras da lista geral usam o nível da lista. Nomes próprios nunca são checados.
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORDER = {"A1": 1, "A2": 2, "B1": 3, "B2": 4}
FRAGMENTS = {"'m", "'s", "'re", "'ll", "'ve", "'d", "n't"}


def data_dir() -> Path:
    return Path(os.environ.get("PIPELINE_DATA_DIR") or ROOT.parent / "pipeline-data")


def load_cefr(path=None):
    """lema -> menor nível em que aparece (qualquer classe gramatical). None se a lista não existir."""
    f = Path(path) if path else data_dir() / "cefrj" / "lemmas.json"
    return json.loads(f.read_text()) if f.exists() else None


def context_vocab(entries):
    """Normaliza o vocabulary do contexto: palavra -> nível mínimo (None = qualquer nível)."""
    out = {}
    for e in entries or []:
        if isinstance(e, dict):
            out[str(e["word"]).lower()] = e.get("from")
        else:
            out[str(e).lower()] = None
    return out


def theme_words_for(entries, level):
    """Palavras do tema liberadas no nível (para listar no prompt)."""
    cap = ORDER.get(level, 99)
    shown = []
    for e in entries or []:
        word, frm = (e["word"], e.get("from")) if isinstance(e, dict) else (e, None)
        if frm is None or ORDER.get(frm, 0) <= cap:
            shown.append(str(word))
    return shown


def check(doc, level, cefr, ctx):
    """Avisos de vocabulário de um Doc. Devolve lista de (palavra, nível|None, tipo)."""
    cap = ORDER.get(level)
    if cefr is None or cap is None:
        return []
    found = []
    for t in doc:
        if t.is_punct or t.is_space or t.pos_ in ("PUNCT", "SYM", "X") or t.lower_ in FRAGMENTS:
            continue
        # Nome próprio = começa com maiúscula. O spaCy marca como PROPN também palavras comuns
        # desconhecidas em minúsculas (ex.: "oven"), e essas precisam ser checadas.
        if t.text[:1].isupper() and (t.pos_ == "PROPN" or t.i != t.sent.start):
            continue
        w = t.lemma_.lower()
        if w in ctx or t.lower_ in ctx:
            frm = ctx.get(w, ctx.get(t.lower_))
            if frm is not None and ORDER.get(frm, 0) > cap:
                found.append((w, frm, "theme_above_level"))
            continue
        lvl = cefr.get(w) or cefr.get(t.lower_)
        if lvl is None:
            if t.pos_ not in ("NUM", "INTJ"):
                found.append((w, None, "unknown"))
        elif ORDER[lvl] > cap:
            found.append((w, lvl, "above_level"))
    return found


def describe(item):
    w, lvl, kind = item
    return {"above_level": f"above level: {w} ({lvl})", "unknown": f"unknown word: {w}",
            "theme_above_level": f"theme word above level: {w} (from {lvl})"}[kind]
