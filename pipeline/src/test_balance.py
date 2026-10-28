"""Testes do balanceamento. Rodar: python -m unittest test_balance -v (dentro de pipeline/src). Sem spaCy."""
import unittest

import balance as b

SIDS = ["a", "b", "c"]
SCENES = ["s1", "s2"]


def item(text, s, scene, confirmed=True, vocab=()):
    return {"text": text, "claimed": s, "matched": [s] if confirmed else [], "scene": scene, "vocab": list(vocab)}


class Quotas(unittest.TestCase):
    def test_quotas_scale_with_pool(self):
        self.assertEqual(b.quotas(10, 6, 130), (9, 13))
        self.assertEqual(b.quotas(3, 0, 10), (2, 0))

    def test_deficits_count_only_confirmed_structures(self):
        acc = [item("x1", "a", "s1"), item("x2", "a", "s1", confirmed=False)]
        d = b.deficits(acc, SIDS, SCENES, pool=30)       # por estrutura: floor(.7*30/3)=7; por cena: floor(.6*30/2)=9
        self.assertEqual(d["structures"], {"a": 6, "b": 7, "c": 7})   # a só tem 1 confirmada
        self.assertEqual(d["scenes"], {"s1": 7, "s2": 9})
        self.assertEqual(d["remaining"], 28)

    def test_no_deficit_when_enough(self):
        acc = [item(f"t{i}", "a", "s1") for i in range(7)]
        self.assertNotIn("a", b.deficits(acc, SIDS, SCENES, 30)["structures"])


class Overused(unittest.TestCase):
    def test_flags_frequent_content_words_not_structural_ones(self):
        acc = [{"text": f"I am very happy {w}."} for w in "one two three four five six".split()]
        words = dict(b.overused(acc))
        self.assertIn("very", words)
        self.assertNotIn("am", words)
        self.assertNotIn("i", words)

    def test_empty(self):
        self.assertEqual(b.overused([]), [])

    def test_character_names_can_be_ignored(self):
        acc = [{"text": f"Carlos is here {w}."} for w in "one two three four".split()]
        self.assertIn("carlos", dict(b.overused(acc)))
        self.assertNotIn("carlos", dict(b.overused(acc, ignore={"carlos"})))


class Stalled(unittest.TestCase):
    def test_quota_that_did_not_move_is_stalled(self):
        prev = {"structures": {"a": 3}, "scenes": {"s2": 5}}
        cur = {"structures": {"a": 1}, "scenes": {"s2": 5}}
        self.assertEqual(b.stalled(prev, cur), ["scene:s2"])


class SelectFinal(unittest.TestCase):
    def pool(self):
        acc = []
        for s, n in (("a", 30), ("b", 12), ("c", 12)):      # estruturas muito desiguais (a >> b, c)
            for i in range(n):
                acc.append(item(f"{s} sentence {i}", s, "s1" if i % 3 else "s2"))
        return acc

    def test_balances_structures_even_when_pool_is_lopsided(self):
        chosen = b.select_final(self.pool(), SIDS, SCENES, n=30)
        cs = {s: sum(1 for x in chosen if x["claimed"] == s) for s in SIDS}
        self.assertEqual(sum(cs.values()), 30)
        self.assertEqual(cs, {"a": 10, "b": 10, "c": 10})

    def test_takes_everything_when_pool_is_small(self):
        acc = self.pool()[:5]
        self.assertEqual(len(b.select_final(acc, SIDS, SCENES, n=30)), 5)

    def test_gives_up_on_exhausted_structure_and_fills_from_others(self):
        pool = [x for x in self.pool() if x["claimed"] != "c"] + [item(f"c sentence {i}", "c", "s1") for i in range(8)]
        chosen = b.select_final(pool, SIDS, SCENES, n=45)
        cs = {s: sum(1 for x in chosen if x["claimed"] == s) for s in SIDS}
        self.assertEqual(cs["c"], 8)                    # esgotou: não inventa
        self.assertEqual(sum(cs.values()), 45)          # e as outras completam o total

    def test_prefers_sentences_without_vocab_warnings(self):
        acc = [item("clean one", "a", "s1"), item("flagged one", "a", "s1", vocab=[["x", "B2", "above_level"]]),
               item("clean two", "a", "s1")] + [item(f"b{i}", "b", "s1") for i in range(5)]
        chosen = {x["text"] for x in b.select_final(acc, ["a", "b"], ["s1"], n=4)}
        self.assertNotIn("flagged one", chosen)

    def test_spreads_scenes(self):
        acc = [item(f"a{i}", "a", "s1") for i in range(10)] + [item(f"a{i}b", "a", "s2") for i in range(10)]
        chosen = b.select_final(acc, ["a"], SCENES, n=10)
        self.assertEqual(sum(1 for x in chosen if x["scene"] == "s1"), 5)


class SameStartCap(unittest.TestCase):
    def pool(self):
        acc = [item(f"There is {i}.", "a", "s1") for i in range(30)]
        acc += [item(f"In place {i}, there is one.", "a", "s2") for i in range(8)]
        acc += [item(f"Is there one {i}?", "a", "s1") for i in range(8)]
        acc += [item(f"Are there two {i}?", "a", "s2") for i in range(8)]
        return acc

    def count(self, chosen, word):
        return sum(1 for x in chosen if b.first_word(x["text"]) == word)

    def test_first_word_ignores_punctuation_and_contractions(self):
        self.assertEqual(b.first_word("There's a bug."), "there")
        self.assertEqual(b.first_word("Yes, there is."), "yes")
        self.assertEqual(b.first_word("  The server is up."), "the")

    def test_cap_limits_the_most_common_opening(self):
        chosen = b.select_final(self.pool(), ["a"], SCENES, n=24, max_same_start=0.25)
        self.assertEqual(len(chosen), 24)
        self.assertEqual(self.count(chosen, "there"), 6)         # floor(.25 * 24)
        self.assertLessEqual(max(self.count(chosen, w) for w in ("in", "is", "are")), 6)

    def test_without_cap_nothing_changes(self):
        chosen = b.select_final(self.pool(), ["a"], SCENES, n=24)
        self.assertGreater(self.count(chosen, "there"), 6)

    def test_infeasible_cap_still_fills_the_playlist(self):
        pool = [item(f"There is {i}.", "a", "s1") for i in range(30)] + [item("Is there one?", "a", "s1")]
        chosen = b.select_final(pool, ["a"], SCENES, n=20, max_same_start=0.25)
        self.assertEqual(len(chosen), 20)                       # o teto cede quando o pool não tem alternativa

    def test_cap_applies_to_every_opening_and_only_then_gives_in(self):
        pool = [item(f"There is {i}.", "a", "s1") for i in range(30)] + [item(f"Is there one {i}?", "a", "s1") for i in range(9)]
        chosen = b.select_final(pool, ["a"], SCENES, n=20, max_same_start=0.25)
        self.assertEqual(len(chosen), 20)
        self.assertEqual(self.count(chosen, "is"), 5)           # floor(.25 * 20): o teto vale para toda abertura
        self.assertEqual(self.count(chosen, "there"), 15)       # esgotadas as alternativas, o teto cede e completa com o resto do pool


class OrderPlaylist(unittest.TestCase):
    def test_groups_by_scene_in_context_order(self):
        items = [item("a one", "a", "s2"), item("a two", "a", "s1"), item("b one", "b", "s2"), item("b two", "b", "s1")]
        out = b.order_playlist(items, ["s1", "s2"], ["a", "b"])
        self.assertEqual([x["scene"] for x in out], ["s1", "s1", "s2", "s2"])

    def test_alternates_structures_inside_a_scene(self):
        items = [item(f"a {i}", "a", "s1") for i in range(3)] + [item(f"b {i}", "b", "s1") for i in range(3)]
        out = b.order_playlist(items, ["s1"], ["a", "b"])
        self.assertEqual([x["claimed"] for x in out], ["a", "b", "a", "b", "a", "b"])

    def test_shorter_first_within_a_structure(self):
        items = [item("a very long sentence here", "a", "s1"), item("a short one", "a", "s1")]
        self.assertEqual(b.order_playlist(items, ["s1"], ["a"])[0]["text"], "a short one")

    def test_unknown_or_missing_scene_goes_last_and_nothing_is_lost(self):
        items = [item("x1", "a", None), item("x2", "a", "zzz"), item("x3", "a", "s1")]
        out = b.order_playlist(items, ["s1"], ["a"])
        self.assertEqual(out[0]["text"], "x3")
        self.assertEqual(len(out), 3)


if __name__ == "__main__":
    unittest.main()
