"""Monta o prompt de geração de um tópico a partir do currículo, do catálogo de recursos e do contexto.

Uso:
  python build_prompt.py --context ../contexts/entrevista-java.yaml --topic subject-pronouns-and-verb-to-be \
      [--count 40] [--schema schema.json] [--state state.json] [--pool 130]

Com --state (gerado por validate.py --update-state), o prompt inclui as frases já aceitas (para não repetir)
e o que ainda falta por estrutura e por cena.

Imprime o prompt na saída padrão. Com --schema, grava também o JSON schema da resposta
(structure e scene viram enums). O template é pipeline/prompts/<versão>/generate.md.
"""
import argparse
import json
import math
from pathlib import Path

import yaml

import balance
import vocab

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "pipeline"
LEVELS = ["a1", "a2", "b1", "b2"]


def load_curriculum():
    topics, baseline = [], []
    for lv in LEVELS:
        f = DOCS / f"curriculum-{lv}.yaml"
        if not f.exists():
            continue
        data = yaml.safe_load(f.read_text())
        baseline = baseline or data.get("baseline", [])
        for t in data["topics"]:
            t["level"] = data["level"]
            topics.append(t)
    return topics, baseline


def feature_line(descs, fid):
    d = descs[fid]
    return f'- {d["label"]}, e.g. "{d["ex"]}"'


def build(context, topic_slug, count=40, version="v1", state=None, pool=130):
    topics, baseline = load_curriculum()
    descs = yaml.safe_load((DOCS / "feature-descriptions.yaml").read_text())["descriptions"]
    all_features = yaml.safe_load((DOCS / "features.yaml").read_text())["features"]

    idx = next((i for i, t in enumerate(topics) if t["slug"] == topic_slug), None)
    if idx is None:
        raise SystemExit(f"tópico inexistente: {topic_slug}")
    topic = topics[idx]
    order = [fid for t in topics for fid in t.get("introduces", [])]
    before = [fid for t in topics[:idx] for fid in t.get("introduces", [])]
    target = topic.get("introduces", [])
    seen = set(before) | set(target)
    forbidden = [fid for fid in order if fid not in seen]
    assert set(order) == set(all_features), "features sem tópico que as introduza"

    structures = topic["structures"]
    min_each = max(1, math.floor(0.7 * count / len(structures)))
    scenes = context.get("scenes", [])
    scene_ids = [s["id"] for s in scenes]
    sid = [s["id"] for s in structures]
    lo, hi = topic["level"]["sentence_words"]["min"], topic["level"]["sentence_words"]["max"]

    chars = context.get("characters", [])
    ctx = [f'Context: {context["name"]}', f'Category: {context["category"]}', f'Description: {context["description"]}']
    if context.get("details"):
        ctx.append(f'Details: {context["details"]}')
    if chars:
        ctx.append("Characters (names are always allowed):\n" + "\n".join(f'  - {c["name"]}: {c["role"]}' for c in chars))
    if scenes:
        def scene_text(s):
            sit = "".join(f"\n      * {x}" for x in s.get("situations", []))
            return f'  - {s["id"]}: {s["desc"]}' + (f"\n    Situations:{sit}" if sit else "")
        ctx.append("Scenes:\n" + "\n".join(scene_text(s) for s in scenes))
    theme = vocab.theme_words_for(context.get("vocabulary"), topic["level"]["code"])
    if theme:
        ctx.append("Theme vocabulary (optional, only where the grammar allows): " + ", ".join(theme))

    accepted = (state or {}).get("accepted", [])
    scene_ids_all = [s["id"] for s in scenes]
    gap = balance.deficits(accepted, sid, scene_ids_all, pool) if accepted else None
    if gap:
        need = gap["structures"]
        quota_rule = ("Write the number of sentences marked \"need N more\" for each structure; a structure marked "
                      "\"enough\" is optional (write it only when it fits). Structures already well covered in earlier rounds "
                      "must not take sentences away from the ones that are missing.")
        structures_block = "\n".join(
            f'- `{s["id"]}`: pattern like "{s["ex"]}" ' + (f"(need {need[s['id']]} more)" if s["id"] in need else "(enough)")
            for s in structures)
        parts = [f"## 2.1 What is still missing\n\nThe playlist already has {len(accepted)} accepted sentences "
                 f"(goal: {pool}). Fill the gaps first.\n"]
        if gap["scenes"]:
            parts.append("- Scenes that still need sentences: " + ", ".join(f"{k} ({v} more)" for k, v in gap["scenes"].items())
                         + ". If a scene cannot be written inside the grammar rules, skip it.")
        over = balance.overused(accepted, ignore={c["name"].lower() for c in chars})
        if over:
            parts.append("- Overused so far, use sparingly: " + ", ".join(f"{w} ({n} sentences)" for w, n in over))
        exclusion = "\n".join(f"- {x['text']}" for x in accepted)
        balance_blocks = ("\n".join(parts) + "\n\n## 2.2 Already written: never repeat\n\n"
                          "Do not write any sentence below, and do not write near-copies of them (the same sentence with one word "
                          "changed, or different punctuation). Write new sentences with new vocabulary and new situations.\n\n"
                          + exclusion + "\n\n")
    else:
        quota_rule = f"Write at least {min_each} sentences for each one and distribute the rest freely."
        structures_block = "\n".join(f'- `{s["id"]}`: pattern like "{s["ex"]}"' for s in structures)
        balance_blocks = ""

    blocks = {
        "quota_rule": quota_rule,
        "balance_blocks": balance_blocks,
        "count": str(count),
        "level": topic["level"]["code"],
        "topic_name": topic["name"],
        "context_name": context["name"],
        "baseline_block": "\n".join(f"- {b}" for b in baseline),
        "allowed_block": "\n".join(feature_line(descs, f) for f in before)
        or "- Nothing yet: this is the first topic. Only the target grammar (1.3) and section 1.1 are available.",
        "target_block": "\n".join(feature_line(descs, f) for f in target)
        or "This topic introduces no new grammar. It is an in-depth review of structures that were already taught: bring more variants of them (different subjects, verbs, tenses, affirmative / negative / question forms, time expressions and sentence positions), following the structures in section 2.",
        "forbidden_block": "\n".join(feature_line(descs, f) for f in forbidden) or "- (nothing: everything has been taught)",
        "one_clause_rule": (
            "- Each sentence is ONE clause: one subject with its verb(s). Never join two clauses, with or without a comma "
            "(no \", and I am...\", no \", but...\", no \"I think he is...\"). You may join words (Tom and Ana, tea or coffee) "
            "and verbs that share the same subject (I can swim and run).\n"
            if "multi_clause" in forbidden else ""
        ),
        "characters_rule": (
            "- Use the characters by name when it fits (names are always allowed), so the sentences feel connected.\n" if chars else ""
        ),
        "min_each": str(min_each),
        "max_same_start": str(max(3, round(count * 0.25))),
        "structures_block": structures_block,
        "context_block": "\n".join(ctx),
        "scene_rule": (
            f"Spread the sentences across the scenes ({', '.join(scene_ids)}) and tag each sentence with its scene id."
            if scenes else 'No scene tags are needed: set "scene" to null.'
        ),
        "word_min": str(lo),
        "word_max": str(hi),
        "structure_ids": ", ".join(sid),
        "scene_ids": ", ".join(scene_ids) if scenes else "null",
    }
    text = (ROOT / "pipeline" / "prompts" / version / "generate.md").read_text()
    for k, v in blocks.items():
        text = text.replace("{{" + k + "}}", v)
    assert "{{" not in text, "marcador sem valor no template"

    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["sentences"],
        "properties": {"sentences": {
            "type": "array", "minItems": 1, "maxItems": count,
            "items": {
                "type": "object", "additionalProperties": False, "required": ["text", "structure", "scene"],
                "properties": {
                    "text": {"type": "string"},
                    "structure": {"type": "string", "enum": sid},
                    "scene": {"enum": scene_ids} if scenes else {"type": "null"},
                },
            },
        }},
    }
    return text, schema


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--context", required=True)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--count", type=int, default=40)
    ap.add_argument("--version", default="v1")
    ap.add_argument("--schema")
    ap.add_argument("--state")
    ap.add_argument("--pool", type=int, default=130)
    a = ap.parse_args()
    state = balance.load_state(a.state, a.topic) if a.state else None
    prompt, schema = build(yaml.safe_load(Path(a.context).read_text()), a.topic, a.count, a.version, state, a.pool)
    print(prompt)
    if a.schema:
        Path(a.schema).write_text(json.dumps(schema, indent=2))
