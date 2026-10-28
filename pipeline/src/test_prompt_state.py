"""Testes do prompt com estado (exclusão e cotas). Sem spaCy. Rodar: python -m unittest test_prompt_state."""
import unittest

import yaml

from build_prompt import ROOT, build

CTX = yaml.safe_load((ROOT / "pipeline" / "contexts" / "entrevista-java.yaml").read_text())
T = "subject-pronouns-and-verb-to-be"


def acc(text, s, scene):
    return {"text": text, "claimed": s, "matched": [s], "scene": scene, "vocab": []}


class PromptWithState(unittest.TestCase):
    def test_without_state_is_the_plain_prompt(self):
        text, _ = build(CTX, T, 40)
        self.assertIn("Write at least", text)
        self.assertNotIn("Already written", text)

    def test_with_state_lists_exclusions_and_gaps(self):
        state = {"accepted": [acc("I am very tired today.", "i-am", "introduction")] * 1 + [
            acc(f"Ana is very happy number {i}.", "name-is", "introduction") for i in range(12)], "history": []}
        text, _ = build(CTX, T, 30, state=state, pool=60)
        self.assertIn("## 2.2 Already written: never repeat", text)
        self.assertIn("- I am very tired today.", text)
        self.assertIn("(need ", text)                    # estruturas com déficit
        self.assertIn("Scenes that still need sentences", text)
        self.assertIn("closing", text)
        self.assertNotIn("Write at least", text)

    def test_covered_structure_is_marked_enough(self):
        state = {"accepted": [acc(f"Ana is happy {i}.", "name-is", "introduction") for i in range(20)], "history": []}
        text, _ = build(CTX, T, 30, state=state, pool=60)
        line = next(l for l in text.splitlines() if l.startswith("- `name-is`"))
        self.assertTrue(line.endswith("(enough)"), line)

    def test_no_marker_left_over(self):
        text, _ = build(CTX, T, 30, state={"accepted": [acc("I am very tired today.", "i-am", "introduction")], "history": []})
        self.assertNotIn("{{", text)


if __name__ == "__main__":
    unittest.main()
