"""Etapa 2: valida as frases candidatas de um tópico.

Uso:
  python validate.py --topic subject-pronouns-and-verb-to-be --input sentences.json \
      [--context ../contexts/entrevista-java.yaml] [--out relatorio.json]

`sentences.json` é a resposta do modelo ({"sentences": [{text, structure, scene}]}) ou uma lista simples.
Cada frase é normalizada como o banco faz, e rejeitada se quebrar alguma regra de texto, a faixa de
palavras do nível ou a ordem gramatical (qualquer recurso do catálogo ainda não introduzido).
Vocabulário acima do nível só gera AVISO (lista CEFR-J em PIPELINE_DATA_DIR, fora do repositório;
exceções e palavras do tema vêm do `vocabulary` do contexto). Depois a playlist aceita é checada como um
todo (cobertura das estruturas, alvo do tópico, começos).
"""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import regex
import spacy
import yaml

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "pipeline"
sys.path.insert(0, str(ROOT / "pipeline"))
from validator.rules import detect  # noqa: E402
import vocab  # noqa: E402

LEVELS = ["a1", "a2", "b1", "b2"]
EMOJI = regex.compile(r"\p{Extended_Pictographic}")
URL_1 = re.compile(r"(https?://|www\.)\S+", re.I)
URL_2 = re.compile(r"\b[a-z0-9-]+\.(com|org|net|io|dev|br)\b", re.I)
ABBREV = re.compile(r"\b(Mr|Mrs|Ms|Dr|Prof|St|vs|etc)\.|\b(?:[A-Za-z]\.){2,}|\be\.g\.|\bi\.e\.", re.I)
ALLOWED_CHARS = re.compile(r"^[A-Za-z' ,.?!;:\-\"]+$")


def normalize_text(text: str) -> str:
    """Mesma normalização de packages/shared (normalizeText) e da função SQL normalize_sentence."""
    t = unicodedata.normalize("NFC", text)
    t = re.sub("[‘’ʼ]", "'", t)
    t = re.sub("[“”]", '"', t)
    t = t.replace("…", "...")
    t = re.sub(r"[\s﻿]+", " ", t)
    return t.strip()


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def load_curriculum():
    topics = []
    for lv in LEVELS:
        f = DOCS / f"curriculum-{lv}.yaml"
        if f.exists():
            data = yaml.safe_load(f.read_text())
            for t in data["topics"]:
                t["level"] = data["level"]
                topics.append(t)
    return topics


def text_errors(text: str, lo: int, hi: int):
    """Regras que não dependem de gramática. Devolve (erros, avisos)."""
    errors = []
    if not text:
        return ["empty text"], []
    if URL_1.search(text) or URL_2.search(text): errors.append("contains a URL")
    if EMOJI.search(text): errors.append("contains an emoji")
    if re.search(r"\d", text): errors.append("contains a digit")
    if ABBREV.search(text): errors.append("contains an abbreviation")
    if not ALLOWED_CHARS.match(text.replace(" ", " ")) and not re.search(r"\d", text) \
            and not EMOJI.search(text):
        errors.append("contains a symbol or non-ASCII character")
    if text[-1] not in ".?!":
        errors.append("does not end with . ? or !")
    n = len(text.split())
    if not lo <= n <= hi:
        errors.append(f"{n} words (range {lo}-{hi})")
    return errors, []


def validate(topic_slug, items, nlp=None, max_same_start=0.25, target_share=0.6, context=None, cefr="auto",
             vocab_share=0.15):
    topics = load_curriculum()
    feats = yaml.safe_load((DOCS / "features.yaml").read_text())["features"]
    idx = next((i for i, t in enumerate(topics) if t["slug"] == topic_slug), None)
    if idx is None:
        raise SystemExit(f"unknown topic: {topic_slug}")
    topic = topics[idx]
    new = set(topic.get("introduces", []))
    allowed = {f for t in topics[: idx + 1] for f in t.get("introduces", [])}
    lo, hi = topic["level"]["sentence_words"]["min"], topic["level"]["sentence_words"]["max"]
    structures = topic["structures"]
    sids = [s["id"] for s in structures]
    nlp = nlp or spacy.load("en_core_web_sm")
    cefr = vocab.load_cefr() if cefr == "auto" else cefr
    ctx_vocab = vocab.context_vocab((context or {}).get("vocabulary"))
    level = topic["level"]["code"]

    results, seen_hash, seen_loose = [], {}, {}
    for n, item in enumerate(items):
        raw = item["text"] if isinstance(item, dict) else item
        text = normalize_text(raw)
        errors, warnings = text_errors(text, lo, hi)
        h = text_hash(text)
        loose = re.sub(r"[^a-z0-9 ]", "", text.lower())
        if h in seen_hash:
            errors.append(f"duplicate of #{seen_hash[h]}")
        elif loose in seen_loose:
            errors.append(f"near-duplicate of #{seen_loose[loose]}")
        else:
            seen_hash[h], seen_loose[loose] = n, n

        doc = nlp(text)
        trig = {f for f, spec in feats.items() if detect(doc, spec, feats)}
        late = sorted(trig - allowed)
        if late:
            errors.append("grammar not taught yet: " + ", ".join(late))
        matched = [s["id"] for s in structures if detect(doc, s["rule"], feats)]
        vocab_found = vocab.check(doc, level, cefr, ctx_vocab)
        warnings += [vocab.describe(v) for v in vocab_found]
        claimed = item.get("structure") if isinstance(item, dict) else None
        if claimed is not None and claimed not in sids:
            warnings.append(f"unknown structure id: {claimed}")
        elif claimed and claimed not in matched:
            warnings.append(f"claimed structure '{claimed}' not detected")
        if not matched:
            warnings.append("no structure of the topic detected")
        results.append({
            "n": n, "text": text, "raw": raw if raw != text else None,
            "accepted": not errors, "errors": errors, "warnings": warnings,
            "claimed": claimed, "matched": matched, "vocab": [list(v) for v in vocab_found],
            "target": bool(trig & new), "scene": item.get("scene") if isinstance(item, dict) else None,
        })

    ok = [r for r in results if r["accepted"]]
    cover = Counter(m for r in ok for m in r["matched"])  # detectada: uma frase conta em todas as regras que disparam
    # confirmada: o modelo declarou a estrutura E a regra a detecta. Sem declaração, cai para a detectada.
    conf = Counter(r["claimed"] if r["claimed"] in r["matched"] else None for r in ok if r["claimed"])
    for r in ok:
        if not r["claimed"]:
            conf.update(r["matched"])
    claim = Counter(r["claimed"] for r in ok if r["claimed"])
    starts = Counter(r["text"].split()[0].lower() for r in ok)
    count_goal = len(items)
    min_each = max(1, int(0.7 * count_goal / len(structures)))
    playlist = []
    if new and ok:
        share = sum(r["target"] for r in ok) / len(ok)
        if share < target_share:
            playlist.append(f"only {share:.0%} of accepted sentences use the topic's new grammar (goal {target_share:.0%})")
    for w, c in starts.most_common(3):
        if ok and c / len(ok) > max_same_start:
            playlist.append(f"{c / len(ok):.0%} of accepted sentences start with '{w}' (limit {max_same_start:.0%})")
    flagged = Counter(v[0] for r in ok for v in r["vocab"])
    n_flag = sum(1 for r in ok if r["vocab"])
    if cefr is None:
        playlist.append("vocabulary not checked: CEFR list not found (run fetch_cefrj.py)")
    elif ok and n_flag / len(ok) > vocab_share:
        playlist.append(f"{n_flag / len(ok):.0%} of accepted sentences have words above the level (limit {vocab_share:.0%}): "
                        + ", ".join(f"{w}={c}" for w, c in flagged.most_common(8)))
    missing = [s for s in sids if conf[s] < min_each]
    if missing:
        playlist.append(f"structures below {min_each} confirmed sentences: " + ", ".join(f"{s}={conf[s]}" for s in missing))
    return {
        "topic": topic_slug, "level": topic["level"]["code"], "words": [lo, hi],
        "total": len(results), "accepted": len(ok), "rejected": len(results) - len(ok),
        "reject_reasons": Counter(e.split(":")[0].split(" (")[0] for r in results for e in r["errors"]),
        "coverage_confirmed": {s: conf[s] for s in sids},
        "coverage_detected": {s: cover[s] for s in sids}, "coverage_claimed": {s: claim[s] for s in sids},
        "scenes": Counter(r["scene"] for r in ok if r["scene"]),
        "vocab_flagged": dict(flagged), "playlist_warnings": playlist, "sentences": results,
    }


def load_items(path):
    data = json.loads(Path(path).read_text())
    return data["sentences"] if isinstance(data, dict) else data


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", required=True)
    ap.add_argument("--input", required=True)
    ap.add_argument("--context")
    ap.add_argument("--out")
    a = ap.parse_args()
    ctx = yaml.safe_load(Path(a.context).read_text()) if a.context else None
    rep = validate(a.topic, load_items(a.input), context=ctx)
    if a.out:
        Path(a.out).write_text(json.dumps(rep, indent=2, ensure_ascii=False, default=dict))
    print(f"{rep['topic']} ({rep['level']}, {rep['words'][0]}-{rep['words'][1]} words): "
          f"{rep['accepted']}/{rep['total']} accepted")
    print("rejection reasons:", dict(rep["reject_reasons"]))
    print("coverage (confirmed = declared and detected):", rep["coverage_confirmed"])
    for w in rep["playlist_warnings"]:
        print("PLAYLIST:", w)
    for r in rep["sentences"]:
        if not r["accepted"]:
            print(f"  REJECT #{r['n']:>3} {r['text']!r}: {'; '.join(r['errors'])}")
        elif r["warnings"]:
            print(f"  warn   #{r['n']:>3} {r['text']!r}: {'; '.join(r['warnings'])}")
