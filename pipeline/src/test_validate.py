"""Testes do validador de frases. Rodar: python -m unittest test_validate -v (dentro de pipeline/src)."""
import unittest

import spacy

from validate import normalize_text, text_errors, validate

NLP = spacy.load("en_core_web_sm")
T1 = "subject-pronouns-and-verb-to-be"


def run(slug, *sentences):
    rep = validate(slug, [{"text": s} for s in sentences], nlp=NLP)
    return rep["sentences"]


class Normalize(unittest.TestCase):
    def test_curly_quotes_and_spaces(self):
        self.assertEqual(normalize_text("  She’s   at “home”… "), 'She\'s at "home"...')

    def test_curly_apostrophe_still_detected_as_contraction(self):
        r = run(T1, "We’re very happy today.")[0]
        self.assertTrue(r["accepted"], r["errors"])
        self.assertEqual(r["text"], "We're very happy today.")


class TextRules(unittest.TestCase):
    def errs(self, t, lo=4, hi=10):
        return text_errors(t, lo, hi)[0]

    def test_ok(self):
        self.assertEqual(self.errs("She is very happy today."), [])

    def test_digit_url_emoji_abbrev_symbol(self):
        self.assertIn("contains a digit", self.errs("I am 20 years old now."))
        self.assertIn("contains a URL", self.errs("Visit www.example.com now please."))
        self.assertIn("contains an emoji", self.errs("I am very happy today \U0001F600."))
        self.assertIn("contains an abbreviation", self.errs("Mr. Smith is here today."))
        self.assertIn("contains a symbol or non-ASCII character", self.errs("I am café ready today."))

    def test_range_and_ending(self):
        self.assertTrue(any("words" in e for e in self.errs("I am here.")))
        self.assertIn("does not end with . ? or !", self.errs("She is very happy today"))


class Grammar(unittest.TestCase):
    def test_target_grammar_accepted(self):
        for s in ["I am very tired today.", "She's at home now.", "They are in London today."]:
            r = run(T1, s)[0]
            self.assertTrue(r["accepted"], (s, r["errors"]))

    def test_later_grammar_rejected_in_topic_1(self):
        cases = {
            "I am a teacher at home.": "art_indefinite",
            "We are good friends today.": "noun_plural",
            "He is my best friend.": "poss_adj",
            "Are you ready for today?": "be_question",
            "She isn't at home today.": "be_negative",
            "The park is very big.": "art_definite",
        }
        for s, feat in cases.items():
            r = run(T1, s)[0]
            self.assertFalse(r["accepted"], s)
            self.assertTrue(any(feat in e for e in r["errors"]), (s, r["errors"]))

    def test_adjectival_participle_is_not_passive(self):
        for t in ["We are done now.", "I am very tired today.", "The shop is closed now."]:
            self.assertFalse(any("passive" in e for e in validate("article-the", [{"text": t}], nlp=NLP)["sentences"][0]["errors"]), t)

    def test_unknown_proper_noun_ending_in_s_is_not_plural(self):
        for t in ["Postgres is very fast.", "Kubernetes is very good at work.", "Tom is in Paris today."]:
            r = run("subject-pronouns-and-verb-to-be", t)[0]
            self.assertFalse(any("noun_plural" in e for e in r["errors"]), (t, r["errors"]))

    def test_real_plural_is_still_caught(self):
        for t in ["Friends are very kind today.", "They are very good friends.", "We are good at games."]:
            r = run("subject-pronouns-and-verb-to-be", t)[0]
            self.assertTrue(any("noun_plural" in e for e in r["errors"]), (t, r["errors"]))

    def test_real_passive_is_still_caught_early(self):
        r = run("present-simple", "The bridge was built by Ana.")[0]
        self.assertTrue(any("passive" in e for e in r["errors"]), r["errors"])

    def test_same_sentence_becomes_valid_when_taught(self):
        self.assertFalse(run(T1, "She is a good teacher.")[0]["accepted"])
        self.assertTrue(run("articles-a-an", "She is a good teacher.")[0]["accepted"])


class OneClause(unittest.TestCase):
    """Até o tópico de conectores (A2 · 13), cada frase tem uma só oração."""

    def rejects(self, slug, text):
        r = run(slug, text)[0]
        return any("multi_clause" in e for e in r["errors"])

    def test_two_clauses_rejected_before_connectors(self):
        for t in ["I am Carlos, and I am from Recife.", "She is tired, but he is ready.",
                  "I am from Brazil, and you?", "It is cold, so we stay home."]:
            self.assertTrue(self.rejects("subject-pronouns-and-verb-to-be", t), t)
        self.assertTrue(self.rejects("present-simple", "I like tea, and she likes coffee."))
        self.assertTrue(self.rejects("future-going-to-and-will", "I will call you, but you are busy."))

    def test_words_and_shared_subject_verbs_allowed(self):
        for slug, t in [("subject-pronouns-and-verb-to-be", "Tom and Ana are ready now."),
                        ("subject-pronouns-and-verb-to-be", "She is very kind and smart."),
                        ("can-ability", "I can swim and run."),
                        ("present-simple", "She gets up and drinks tea."),
                        ("imperative", "Stand up and sit down, please."),
                        ("present-simple", "We eat rice or beans.")]:
            self.assertFalse(self.rejects(slug, t), t)

    def test_two_clauses_allowed_from_connectors_topic(self):
        for t in ["I like tea, but she likes coffee.", "It was cold, so we stayed home."]:
            self.assertFalse(self.rejects("simple-connectors", t), t)


class Duplicates(unittest.TestCase):
    def test_exact_and_near(self):
        rs = run(T1, "I am very tired today.", "I am very tired today.", "i am very tired today!")
        self.assertTrue(rs[0]["accepted"])
        self.assertTrue(any("duplicate" in e for e in rs[1]["errors"]))
        self.assertTrue(any("duplicate" in e for e in rs[2]["errors"]))


if __name__ == "__main__":
    unittest.main()
