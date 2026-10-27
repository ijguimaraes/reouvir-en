"""Escolhe as frases finais de uma playlist a partir do estado (todas as aceitas), equilibrando
estruturas e cenas. A ordenação final e a gravação no banco vêm depois (etapa 4).

Uso: python select_final.py --topic <slug> --state state.json [--context ../contexts/x.yaml] [--n 100] [--max-same-start 0.25] [--out final.json]
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import yaml

import balance
from validate import load_curriculum

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", required=True)
    ap.add_argument("--state", required=True)
    ap.add_argument("--context")
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--max-same-start", type=float, help="teto por palavra de abertura, em fração de n (ex.: 0.25)")
    ap.add_argument("--out")
    a = ap.parse_args()
    topic = next(t for t in load_curriculum() if t["slug"] == a.topic)
    sids = [s["id"] for s in topic["structures"]]
    state = balance.load_state(a.state, a.topic)
    ctx = yaml.safe_load(Path(a.context).read_text()) if a.context else {}
    scenes = [s["id"] for s in ctx.get("scenes", [])] or sorted({x["scene"] for x in state["accepted"] if x.get("scene")})
    chosen = balance.select_final(state["accepted"], sids, scenes, a.n, a.max_same_start)
    print(f"{len(chosen)} de {len(state['accepted'])} frases escolhidas (alvo {a.n})")
    print("aberturas mais comuns:", Counter(balance.first_word(x["text"]) for x in chosen).most_common(4))
    st, sc = Counter(balance.structure_of(x, strict=False) for x in chosen), Counter(x.get("scene") for x in chosen)
    print("por estrutura:", {s: st[s] for s in sids})
    print("por cena:", {s: sc[s] for s in scenes})
    print("com aviso de vocabulário:", sum(1 for x in chosen if x.get("vocab")))
    if a.out:
        # o write_db.py respeita a ordem do arquivo: aqui ela vira um roteiro (cenas na ordem do contexto)
        ordered = balance.order_playlist(chosen, scenes, sids)
        Path(a.out).write_text(json.dumps({"sentences": ordered}, indent=1, ensure_ascii=False))
