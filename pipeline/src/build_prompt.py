"""Monta o prompt de geração de um tópico a partir do currículo, do catálogo de recursos e do contexto.

Uso:
  python build_prompt.py --context ../contexts/entrevista-java.yaml --topic subject-pronouns-and-verb-to-be \
      [--count 40] [--schema schema.json]

Imprime o prompt na saída padrão. Com --schema, grava também o JSON schema da resposta
(structure e scene viram enums). O template é pipeline/prompts/<versão>/generate.md.
"""
import argparse
import json
import math
from pathlib import Path

import yaml

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


def build(context, topic_slug, count=40, version="v1"):
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

    ctx = [f'Context: {context["name"]}', f'Category: {context["category"]}', f'Description: {context["description"]}']
    if context.get("details"):
        ctx.append(f'Details: {context["details"]}')
    if scenes:
        ctx.append("Scenes:\n" + "\n".join(f'  - {s["id"]}: {s["desc"]}' for s in scenes))
    if context.get("vocabulary"):
        ctx.append("Theme vocabulary (optional, only where the grammar allows): " + ", ".join(context["vocabulary"]))

    blocks = {
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
        "min_each": str(min_each),
        "max_same_start": str(max(3, round(count * 0.25))),
        "structures_block": "\n".join(f'- `{s["id"]}`: pattern like "{s["ex"]}"' for s in structures),
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
    a = ap.parse_args()
    prompt, schema = build(yaml.safe_load(Path(a.context).read_text()), a.topic, a.count, a.version)
    print(prompt)
    if a.schema:
        Path(a.schema).write_text(json.dumps(schema, indent=2))
