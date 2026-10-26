"""Balanceamento entre lotes: estado da playlist, cotas, déficits, palavras repetidas e seleção final.

O estado (`state.json`, em PIPELINE_DATA_DIR/runs/...) guarda as frases já ACEITAS pelo validador. Cada
lote novo recebe no prompt (1) a lista do que já existe, para não repetir, e (2) o que ainda falta por
estrutura e por cena. A seleção final escolhe as ~100 frases da playlist equilibrando estruturas e cenas.
"""
import json
import math
import re
from collections import Counter
from pathlib import Path

STRUCT_SHARE = 0.7   # cada estrutura deve ter 70% da sua parte igual do pool
SCENE_SHARE = 0.6    # idem para cenas (mais frouxo: algumas cenas não cabem em tópicos básicos)
KEEP = ("text", "claimed", "matched", "scene", "target", "vocab")
# Palavras estruturais que sempre se repetem; não contam como "repetidas demais".
STOP = set("i you he she it we they am is are be 's 'm 're and or at in from to for with the a an not".split())


def quotas(n_structures, n_scenes, pool):
    per_struct = max(1, math.floor(STRUCT_SHARE * pool / n_structures))
    per_scene = max(1, math.floor(SCENE_SHARE * pool / n_scenes)) if n_scenes else 0
    return per_struct, per_scene


def structure_of(item, strict=True):
    """Estrutura da frase. strict: só a CONFIRMADA (declarada e detectada). Senão, cai para a declarada."""
    claimed, matched = item.get("claimed"), item.get("matched") or []
    if claimed and claimed in matched:
        return claimed
    if strict:
        return matched[0] if (not claimed and matched) else None
    return claimed or (matched[0] if matched else None)


def counts(accepted, structure_ids, scene_ids):
    s = Counter(structure_of(x) for x in accepted)
    c = Counter(x.get("scene") for x in accepted)
    return {k: s[k] for k in structure_ids}, {k: c[k] for k in scene_ids}


def deficits(accepted, structure_ids, scene_ids, pool):
    per_s, per_c = quotas(len(structure_ids), len(scene_ids), pool)
    cs, cc = counts(accepted, structure_ids, scene_ids)
    return {
        "structures": {k: per_s - v for k, v in cs.items() if v < per_s},
        "scenes": {k: per_c - v for k, v in cc.items() if v < per_c},
        "remaining": max(0, pool - len(accepted)),
        "per_structure": per_s, "per_scene": per_c,
    }


def overused(accepted, threshold=0.15, top=6, ignore=()):
    """Palavras que aparecem em mais de `threshold` das frases (fora as estruturais e as `ignore`)."""
    if not accepted:
        return []
    c = Counter()
    for x in accepted:
        c.update(set(re.findall(r"[a-z']+", x["text"].lower())) - STOP - set(ignore))
    return [(w, n) for w, n in c.most_common(top) if n / len(accepted) >= threshold]


def stalled(prev, cur):
    """Cotas que o lote anterior pedia e continuam (ou pioraram) mesmo assim: provavelmente difíceis demais."""
    out = []
    for kind in ("structures", "scenes"):
        for k, v in (prev or {}).get(kind, {}).items():
            if cur[kind].get(k, 0) >= v:
                out.append(f"{kind[:-1]}:{k}")
    return out


def new_state(topic):
    return {"topic": topic, "accepted": [], "history": []}


def load_state(path, topic):
    p = Path(path)
    if p.exists():
        st = json.loads(p.read_text())
        if st["topic"] != topic:
            raise SystemExit(f"state is for topic {st['topic']}, not {topic}")
        return st
    return new_state(topic)


def save_state(path, state):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(state, indent=1, ensure_ascii=False))


def item_from_result(r):
    return {k: r.get(k) for k in KEEP}


def select_final(accepted, structure_ids, scene_ids, n=100):
    """Escolhe n frases equilibrando estruturas (rodízio) e cenas (a menos representada primeiro).
    Prefere frases com a estrutura confirmada, sem aviso de vocabulário e mais curtas."""
    pool = [x for x in accepted if structure_of(x, strict=False) in structure_ids]
    if len(pool) <= n:
        return list(pool)
    by = {s: [x for x in pool if structure_of(x, strict=False) == s] for s in structure_ids}
    chosen, per_struct, per_scene = [], Counter(), Counter()
    rank = lambda x: (structure_of(x) is None, len(x.get("vocab") or []), len(x["text"]))
    while len(chosen) < n:
        avail = [s for s in structure_ids if by[s]]
        if not avail:
            break
        s = min(avail, key=lambda k: (per_struct[k], structure_ids.index(k)))
        best = min(by[s], key=lambda x: (per_scene[x.get("scene")],) + rank(x))
        by[s].remove(best)
        chosen.append(best)
        per_struct[s] += 1
        per_scene[best.get("scene")] += 1
    return chosen
