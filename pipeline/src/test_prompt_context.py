"""Testes do `details` vindo do banco no prompt. Sem spaCy nem Postgres. Rodar: python -m unittest test_prompt_context."""
import unittest

import yaml

from build_prompt import ROOT, build, with_db_details

CTX = yaml.safe_load((ROOT / "pipeline" / "contexts" / "entrevista-java.yaml").read_text())
T = "subject-pronouns-and-verb-to-be"


class DetailsFromDb(unittest.TestCase):
    def test_db_text_replaces_the_yaml_details(self):
        ctx, digest = with_db_details(CTX, fetch=lambda slug: "Texto do banco.\nSegunda linha.")
        text, _ = build(ctx, T, 20)
        self.assertIn("Details: Texto do banco.\nSegunda linha.", text)
        self.assertNotIn(CTX["details"][:40], text)
        self.assertEqual(len(digest), 64)
        self.assertIn(CTX["details"][:40], CTX["details"])  # o contexto original não é alterado
        self.assertNotEqual(ctx["details"], CTX["details"])

    def test_yaml_stays_when_the_database_has_nothing(self):
        for empty in (None, ""):
            ctx, digest = with_db_details(CTX, fetch=lambda slug, v=empty: v)
            self.assertIs(ctx, CTX)
            self.assertIsNone(digest)
            text, _ = build(ctx, T, 20)
            self.assertIn(CTX["details"][:40], text)

    def test_fetch_gets_the_context_slug(self):
        seen = []
        with_db_details(CTX, fetch=lambda slug: seen.append(slug))
        self.assertEqual(seen, [CTX["slug"]])

    def test_same_text_same_digest(self):
        _, a = with_db_details(CTX, fetch=lambda s: "abc")
        _, b = with_db_details(CTX, fetch=lambda s: "abc")
        _, c = with_db_details(CTX, fetch=lambda s: "abd")
        self.assertEqual(a, b)
        self.assertNotEqual(a, c)


if __name__ == "__main__":
    unittest.main()
