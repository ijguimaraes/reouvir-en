"""Testes de integração do write_db.py e do create_pipeline_role.py contra um Postgres de verdade.

Precisam de um Postgres descartável (NUNCA o banco de desenvolvimento): defina PIPELINE_TEST_ADMIN_URL com
um superusuário, por exemplo
  docker run -d --name reouvir-pipeline-test -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin-test-pw \
      -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data postgres:17
  PIPELINE_TEST_ADMIN_URL=postgres://admin:admin-test-pw@127.0.0.1:55432/postgres python -m unittest test_write_db -v
Sem a variável, os testes são pulados. Cada teste usa um banco novo, clonado de um molde com as migrações.
"""
import hashlib
import os
from unittest import mock
import re
import tempfile
import unittest
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg

import create_pipeline_role as cpr
import write_db as w
from build_prompt import ROOT

ADMIN = os.environ.get("PIPELINE_TEST_ADMIN_URL")
MIGRATIONS = ROOT / "apps" / "api" / "src" / "db" / "migrations"
TEMPLATE = "tpl_reouvir_pipeline"
PLAYLIST = "test-playlist"
CTX = {"slug": "test-context", "scenes": [{"id": "intro"}, {"id": "work"}]}


def with_db(url, db):
    u = urlsplit(url)
    return urlunsplit((u.scheme, u.netloc, "/" + db, u.query, u.fragment))


def make_template():
    with psycopg.connect(ADMIN, autocommit=True) as c:
        if c.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEMPLATE,)).fetchone():
            c.execute(f'DROP DATABASE "{TEMPLATE}"')
        c.execute(f'CREATE DATABASE "{TEMPLATE}"')
    with psycopg.connect(with_db(ADMIN, TEMPLATE), autocommit=True) as c:
        for f in sorted(MIGRATIONS.glob("*.sql")):
            up = re.search(r"-- migrate:up(.*?)-- migrate:down", f.read_text(), re.S).group(1)
            c.execute(up)


def sent(text, structure="i-am", scene="intro"):
    return {"text": text, "claimed": structure, "scene": scene}


WORDS = "red blue green pink gold gray brown white black amber coral ivory jade lime navy olive peach plum rose ruby sand tan teal".split()


def items(n, prefix="Sentence", scene="intro"):
    """Frases válidas e distintas (sem dígitos, que o gravador recusa)."""
    return [sent(f"{prefix} {WORDS[i]} is here today.", "i-am", scene) for i in range(n)]


@unittest.skipUnless(ADMIN, "defina PIPELINE_TEST_ADMIN_URL (Postgres descartável)")
class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        make_template()

    def setUp(self):
        self.db = "t_" + uuid.uuid4().hex[:10]
        with psycopg.connect(ADMIN, autocommit=True) as c:
            c.execute(f'CREATE DATABASE "{self.db}" TEMPLATE "{TEMPLATE}"')
        self.admin_url = with_db(ADMIN, self.db)
        self.role = "pw_" + self.db
        self.extra_roles = []
        env = Path(tempfile.mkdtemp()) / "pipeline.env"
        self.assertEqual(cpr.main(["--admin-url", self.admin_url, "--role", self.role, "--env-file", str(env)]), 0)
        self.url = env.read_text().split("=", 1)[1].strip()
        self.admin("INSERT INTO contexts (slug, name, category) VALUES (%s, 'Test', 'Test')", (CTX["slug"],))
        self.add_playlist(CTX["slug"], PLAYLIST)

    def tearDown(self):
        with psycopg.connect(ADMIN, autocommit=True) as c:
            c.execute(f'DROP DATABASE "{self.db}" WITH (FORCE)')
            for r in [self.role] + self.extra_roles:
                c.execute(f'DROP ROLE IF EXISTS "{r}"')

    def admin(self, q, params=None):
        with psycopg.connect(self.admin_url, autocommit=True) as c:
            cur = c.execute(q, params)
            return cur.fetchall() if cur.description else None

    def add_playlist(self, context_slug, slug, position=1):
        """Playlists nascem no backoffice; aqui o teste faz o papel dele."""
        self.admin("INSERT INTO playlists (context_id, title, slug, position) "
                   "SELECT id, 'Playlist de teste', %s, %s FROM contexts WHERE slug = %s", (slug, position, context_slug))

    def run_w(self, its, **kw):
        return w.run(self.url, PLAYLIST, CTX, its, **kw)

    def rows(self):
        return self.admin("SELECT s.position, s.text, s.id FROM sentences s ORDER BY s.position")

    def version(self):
        return self.admin("SELECT version FROM playlists")[0][0]


class RoleTests(Base):
    def test_role_is_not_privileged_and_only_has_what_the_pipeline_needs(self):
        r = self.admin("SELECT rolsuper, rolcreatedb, rolcreaterole, rolcanlogin FROM pg_roles WHERE rolname = %s", (self.role,))[0]
        self.assertEqual(r, (False, False, False, True))
        self.assertEqual(cpr.verify(self.url), [])

    def test_rerun_is_idempotent_and_keeps_the_password(self):
        env = Path(tempfile.mkdtemp()) / "x.env"
        self.assertEqual(cpr.main(["--admin-url", self.admin_url, "--role", self.role, "--env-file", str(env)]), 0)
        self.assertFalse(env.exists())                  # não gerou senha nova
        with psycopg.connect(self.url) as c:            # a senha antiga continua valendo
            c.execute("SELECT 1")

    def test_rotate_changes_the_password(self):
        env = Path(tempfile.mkdtemp()) / "new.env"
        self.assertEqual(cpr.main(["--admin-url", self.admin_url, "--role", self.role, "--rotate", "--env-file", str(env)]), 0)
        new_url = env.read_text().split("=", 1)[1].strip()
        self.assertNotEqual(new_url, self.url)
        with self.assertRaises(psycopg.OperationalError):
            psycopg.connect(self.url)

    def test_env_file_is_private(self):
        env = Path(tempfile.mkdtemp()) / "p.env"
        self.extra_roles.append(self.role + "_b")
        cpr.main(["--admin-url", self.admin_url, "--role", self.role + "_b", "--env-file", str(env)])
        self.assertEqual(oct(env.stat().st_mode & 0o777), "0o600")


class WriteTests(Base):
    def test_first_write_fills_the_playlist(self):
        its = [sent("I am very happy today.", "i-am", "intro"), sent("She is at work now.", "he-she-is", "work"),
               sent("I'm ready for work.", "contraction", "intro")]
        rep = self.run_w(its, prompt_version="v9", model="m1")
        self.assertEqual((rep["added"], rep["kept"], rep["removed"]), (3, 0, 0))
        self.assertEqual(self.admin("SELECT status, title, slug, position FROM playlists"), [("draft", "Playlist de teste", PLAYLIST, 1)])
        rows = self.rows()
        self.assertEqual([r[0] for r in rows], [1, 2, 3])
        self.assertEqual([r[1] for r in rows], [x["text"] for x in its])   # a ordem do arquivo é a da playlist
        meta = self.admin("SELECT metadata FROM sentences ORDER BY position")
        self.assertEqual(meta[0][0], {"origin": "pipeline", "prompt_version": "v9", "model": "m1", "scene": "intro", "structure": "i-am"})
        self.assertGreater(self.version(), 1)
        self.assertTrue(all(h for (h,) in self.admin("SELECT text_hash FROM sentences")))   # trigger do banco

    def test_removing_a_sentence_also_drops_the_students_listen_counts(self):
        first = items(3)
        self.run_w(first)
        sid = self.admin("SELECT id FROM sentences WHERE position = 1")[0][0]
        self.admin("INSERT INTO users (email, name, password_hash) VALUES ('a@t.com', 'A', 'x')")
        self.admin("INSERT INTO user_sentence_stats (user_id, sentence_id, listen_count) "
                   "SELECT id, %s, 7 FROM users", (sid,))
        self.run_w(first[1:], replace=True)                  # a frase 1 sai; o papel da pipeline não toca nas estatísticas
        self.assertEqual(self.admin("SELECT count(*) FROM user_sentence_stats"), [(0,)])

    def test_translation_is_written_with_the_sentence_and_kept_when_omitted(self):
        its = [dict(sent("I am very happy today.", "i-am", "intro"), translation_pt="  Estou muito   feliz hoje. "),
               sent("She is at work now.", "he-she-is", "work")]
        self.run_w(its)
        self.assertEqual(self.admin("SELECT translation_pt FROM sentences ORDER BY position"), [("Estou muito feliz hoje.",), (None,)])
        # reenviar sem o campo não apaga a tradução; com o campo, atualiza (e sobe a versão)
        before = self.version()
        rep = self.run_w([sent("I am very happy today.", "i-am", "intro"), sent("She is at work now.", "he-she-is", "work")],
                         replace=True)
        self.assertEqual((rep["added"], rep["removed"], rep["moved"]), (0, 0, 0))
        self.assertEqual(self.version(), before)
        self.run_w([dict(sent("I am very happy today.", "i-am", "intro"), translationPt="Estou muito contente hoje."), its[1]], replace=True)
        self.assertEqual(self.admin("SELECT translation_pt FROM sentences ORDER BY position")[0], ("Estou muito contente hoje.",))
        self.assertGreater(self.version(), before)

    def test_playlist_order_is_exactly_the_input_order(self):
        # tamanhos e cenas misturados de propósito: nada de reordenar por cena nem por comprimento
        texts = ["This is the longest sentence of the whole list today.", "Short one here today.", "Medium length sentence is here.",
                 "Another very long sentence goes right here for the test.", "Tiny one here ok."]
        its = [sent(t, "i-am", scene) for t, scene in zip(texts, ["work", "intro", "work", "intro", "work"])]
        self.run_w(its)
        self.assertEqual([r[1] for r in self.rows()], texts)
        self.assertEqual([r[0] for r in self.rows()], [1, 2, 3, 4, 5])
        # trocar a ordem do arquivo troca a ordem da playlist, mantendo os ids (áudio) das mesmas frases
        ids = {t: i for _, t, i in self.rows()}
        rep = self.run_w(list(reversed(its)), replace=True)
        self.assertEqual((rep["added"], rep["removed"], rep["kept"]), (0, 0, 5))
        self.assertEqual([r[1] for r in self.rows()], list(reversed(texts)))
        self.assertEqual({t: i for _, t, i in self.rows()}, ids)

    def test_dry_run_changes_nothing_but_reports_what_would_happen(self):
        rep = self.run_w(items(5), dry_run=True)
        self.assertTrue(rep["dry_run"])
        self.assertEqual(rep["added"], 5)
        self.assertEqual(self.admin("SELECT count(*) FROM sentences")[0][0], 0)

    def test_rerun_with_same_input_is_a_noop_and_does_not_bump_version(self):
        self.run_w(items(6))
        v = self.version()
        rep = self.run_w(items(6))                      # sem --replace: nada mudou, então não recusa
        self.assertEqual((rep["added"], rep["removed"], rep["moved"]), (0, 0, 0))
        self.assertEqual(self.version(), v)

    def test_existing_sentences_require_replace(self):
        self.run_w(items(4))
        with self.assertRaises(w.Refusal) as e:
            self.run_w(items(4, prefix="Other"))
        self.assertIn("--replace", str(e.exception))
        self.assertEqual(len(self.rows()), 4)           # intacto

    def test_replace_keeps_ids_of_identical_sentences(self):
        first = items(5)
        self.run_w(first)
        ids = {t: i for _, t, i in self.rows()}
        second = first[1:] + [sent("A brand new sentence is here.", "i-am", "intro")]   # sai a 0, entra uma nova
        rep = self.run_w(second, replace=True)
        self.assertEqual((rep["kept"], rep["added"], rep["removed"]), (4, 1, 1))
        after = {t: i for _, t, i in self.rows()}
        for t in [x["text"] for x in first[1:]]:
            self.assertEqual(after[t], ids[t])          # mesmo id = mesmo texto = áudio reaproveitado
        self.assertNotIn(first[0]["text"], after)
        self.assertEqual([r[0] for r in self.rows()], [1, 2, 3, 4, 5])

    def test_published_playlist_is_refused_unless_allowed(self):
        self.run_w(items(3))
        self.admin("UPDATE playlists SET status = 'published', published_at = now()")
        with self.assertRaises(w.Refusal) as e:
            self.run_w(items(3, prefix="New"), replace=True)
        self.assertIn("PUBLICADA", str(e.exception))
        self.assertEqual(len(self.rows()), 3)
        rep = self.run_w(items(3, prefix="New"), replace=True, allow_published=True)
        self.assertEqual(rep["added"], 3)
        self.assertEqual(self.admin("SELECT status FROM playlists"), [("published",)])   # a pipeline não mexe no status

    def test_published_noop_is_allowed(self):
        self.run_w(items(3))
        self.admin("UPDATE playlists SET status = 'published', published_at = now()")
        self.assertEqual(self.run_w(items(3))["added"], 0)

    def test_missing_context_gives_a_clear_message_and_writes_nothing(self):
        self.admin("DELETE FROM playlists"); self.admin("DELETE FROM contexts")
        with self.assertRaises(w.Refusal) as e:
            self.run_w(items(3))
        self.assertIn("backoffice", str(e.exception))
        self.assertEqual(self.admin("SELECT count(*) FROM sentences")[0][0], 0)

    def test_missing_playlist_gives_a_clear_message_and_creates_nothing(self):
        with self.assertRaises(w.Refusal) as e:
            w.run(self.url, "nao-existe", CTX, items(3))
        self.assertIn("nao-existe", str(e.exception))
        self.assertIn("backoffice", str(e.exception))
        self.assertEqual(self.admin("SELECT count(*) FROM playlists")[0][0], 1)    # a pipeline não cria playlist
        self.assertEqual(self.admin("SELECT count(*) FROM sentences")[0][0], 0)

    def test_playlist_slug_only_identifies_a_playlist_inside_its_context(self):
        self.admin("INSERT INTO contexts (slug, name, category) VALUES ('other', 'Other', 'X')")
        self.add_playlist("other", PLAYLIST)                         # mesmo slug, outro contexto
        self.run_w(items(2))
        per_context = self.admin("SELECT c.slug, count(s.id) FROM contexts c JOIN playlists p ON p.context_id = c.id "
                                 "LEFT JOIN sentences s ON s.playlist_id = p.id GROUP BY c.slug ORDER BY c.slug")
        self.assertEqual(per_context, [("other", 0), (CTX["slug"], 2)])

    def test_duplicate_after_normalization_is_refused_before_touching_the_db(self):
        with self.assertRaises(w.Refusal):
            self.run_w([sent("It's very nice here."), sent("It’s  very nice here.")])
        self.assertEqual(self.admin("SELECT count(*) FROM sentences")[0][0], 0)

    def test_text_is_normalized_like_the_database_does(self):
        self.run_w([sent("  It’s   very nice here today.  ")])
        self.assertEqual(self.rows()[0][1], "It's very nice here today.")

    def test_word_range_is_optional_and_enforced_when_given(self):
        long_one = sent("This sentence has quite a few more words than the short range allows here.")
        self.assertEqual(self.run_w(items(2) + [long_one])["added"], 3)           # sem faixa, vale
        with self.assertRaises(w.Refusal):
            self.run_w(items(2) + [long_one], word_range=(4, 10), replace=True)
        self.assertEqual(w.parse_words("4-10"), (4, 10))
        self.assertIsNone(w.parse_words(None))
        with self.assertRaises(SystemExit):
            w.parse_words("10-4")

    def test_failure_inside_the_transaction_rolls_everything_back(self):
        self.run_w(items(3))
        v, before = self.version(), self.rows()
        # força o gravador a errar DEPOIS de apagar e inserir: o hash esperado fica errado, e a conferência final
        # no banco falha. Tudo (inclusive a versão) tem de voltar ao que era.
        wrong = lambda t: hashlib.sha256((t + "!").encode()).hexdigest()   # distintos entre si, mas diferentes dos do banco
        with mock.patch.object(w, "text_hash", wrong):
            with self.assertRaises(RuntimeError):
                self.run_w(items(3, prefix="Fresh"), replace=True)
        self.assertEqual(self.rows(), before)
        self.assertEqual(self.version(), v)

    def test_writer_refuses_text_that_the_validator_would_refuse(self):
        invisible = "\u200b" * 5 + "."
        for bad in [invisible, "I am 20 years old now.", "Visit www.example.com now please.",
                    "I am very caf\u00e9 ready today.", "I am very happy today", "Ok."]:
            with self.assertRaises(w.Refusal, msg=repr(bad)):
                self.run_w(items(2) + [sent(bad)], word_range=(4, 10))
        self.assertEqual(self.admin("SELECT count(*) FROM sentences")[0][0], 0)

    def test_pipeline_role_cannot_touch_students_data_even_through_write_db(self):
        self.run_w(items(2))
        with psycopg.connect(self.url) as c, self.assertRaises(psycopg.errors.InsufficientPrivilege):
            c.execute("SELECT * FROM users")


if __name__ == "__main__":
    unittest.main()
