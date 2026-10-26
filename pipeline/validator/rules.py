"""Mini-DSL de regras sobre um Doc do spaCy.

spec  := cond | {all: [spec]} | {any: [spec]} | {not: spec} | {feature: id}
         | {doc_re: regex} | {doc_not_re: regex} | [spec, ...]  (lista = any)
cond  := dict de condições sobre UM token (todas precisam valer):
  lower, lemma, tag, pos, dep      str ou lista (igualdade)
  not_lower, not_lemma, not_dep    str ou lista
  re / not_re                      regex (search) sobre o texto em minúsculas
  sent_start                       bool
  child / right / left             cond ou lista de conds (lista = todas, em filhos distintos ou não)
  no_child                         cond (nenhum filho satisfaz)
  head / prev / next               cond sobre o token cabeça / anterior / seguinte
  not_next                         o token seguinte NÃO satisfaz a cond
"""
import re


def _as_list(v):
    return v if isinstance(v, list) else [v]


def _tok(t, c):
    for k, v in c.items():
        if k == "lower":
            if t.lower_ not in _as_list(v): return False
        elif k == "not_lower":
            if t.lower_ in _as_list(v): return False
        elif k == "lemma":
            if t.lemma_.lower() not in _as_list(v): return False
        elif k == "not_lemma":
            if t.lemma_.lower() in _as_list(v): return False
        elif k == "tag":
            if t.tag_ not in _as_list(v): return False
        elif k == "pos":
            if t.pos_ not in _as_list(v): return False
        elif k == "dep":
            if t.dep_ not in _as_list(v): return False
        elif k == "not_dep":
            if t.dep_ in _as_list(v): return False
        elif k == "re":
            if not re.search(v, t.lower_): return False
        elif k == "not_re":
            if re.search(v, t.lower_): return False
        elif k == "sent_start":
            if (t.i == t.sent.start) != v: return False
        elif k in ("child", "right", "left"):
            pool = {"child": t.children, "right": t.rights, "left": t.lefts}[k]
            pool = list(pool)
            for sub in _as_list(v):
                if not any(_tok(ch, sub) for ch in pool): return False
        elif k == "no_child":
            if any(_tok(ch, v) for ch in t.children): return False
        elif k == "head":
            if not _tok(t.head, v): return False
        elif k == "prev":
            if t.i == 0 or not _tok(t.doc[t.i - 1], v): return False
        elif k == "not_next":
            if t.i + 1 < len(t.doc) and _tok(t.doc[t.i + 1], v): return False
        elif k == "next":
            if t.i + 1 >= len(t.doc) or not _tok(t.doc[t.i + 1], v): return False
        else:
            raise ValueError(f"condição desconhecida: {k}")
    return True


def detect(doc, spec, features=None):
    if isinstance(spec, list):
        return any(detect(doc, s, features) for s in spec)
    if "all" in spec: return all(detect(doc, s, features) for s in spec["all"])
    if "any" in spec: return any(detect(doc, s, features) for s in spec["any"])
    if "not" in spec: return not detect(doc, spec["not"], features)
    if "feature" in spec: return detect(doc, features[spec["feature"]], features)
    if "doc_re" in spec: return re.search(spec["doc_re"], doc.text) is not None
    if "doc_not_re" in spec: return re.search(spec["doc_not_re"], doc.text) is None
    return any(_tok(t, spec) for t in doc)


def feature_refs(spec):
    """Ids de features referenciados diretamente numa spec."""
    if isinstance(spec, list):
        return {r for s in spec for r in feature_refs(s)}
    if not isinstance(spec, dict): return set()
    out = set()
    if "feature" in spec: out.add(spec["feature"])
    for k in ("all", "any"):
        if k in spec: out |= {r for s in spec[k] for r in feature_refs(s)}
    if "not" in spec: out |= feature_refs(spec["not"])
    return out
