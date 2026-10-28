"""Cria (ou atualiza) a role do Postgres usada pela pipeline, com o mínimo de permissões.

A pipeline só precisa de: ler contextos e playlists; gravar frases. Nada de
usuários, tokens, configurações nem progresso de alunos. Esta role NÃO é superusuária e NÃO é dona de tabelas.

Uso (conectado como um usuário administrador do banco):
  python create_pipeline_role.py --admin-url postgres://admin:...@localhost:5432/reouvir [--rotate] [--print-url]

- Role nova: gera uma senha aleatória e grava a URL de conexão em PIPELINE_DATA_DIR/pipeline-db.env
  (modo 600, fora do git). A senha não é impressa, a menos que se passe --print-url.
- Role já existente: só reaplica as permissões (idempotente). A senha só muda com --rotate.
- Sempre termina verificando, conectado como a nova role, o que ela pode e o que NÃO pode fazer.

Por que UPDATE em playlists? Os triggers do banco rodam com o direito de quem grava: subir a `version` da playlist
(UPDATE só na coluna version). Playlists e contextos são criados no backoffice, nunca pela pipeline.
"""
import argparse
import os
import secrets
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit

import psycopg
from psycopg import sql

from vocab import data_dir

DEFAULT_ROLE = "pipeline_writer"

# (tabela, privilégios). Tudo o que não está aqui é negado.
GRANTS = [
    ("contexts", ["SELECT"]),
    ("playlists", ["SELECT"]),
    ("sentences", ["SELECT", "INSERT", "UPDATE", "DELETE"]),
]
COLUMN_GRANTS = [("playlists", "UPDATE", ["version"])]

SHOULD_WORK = [
    "SELECT count(*) FROM sentences",
    "SELECT count(*) FROM contexts",
    "SELECT count(*) FROM playlists",
    "UPDATE playlists SET version = version WHERE false",
]
SHOULD_FAIL = [
    "SELECT * FROM users",
    "SELECT * FROM refresh_tokens",
    "SELECT * FROM user_settings",
    "UPDATE playlists SET status = 'published' WHERE false",
    "DELETE FROM playlists WHERE false",
    "UPDATE contexts SET name = name WHERE false",
    "INSERT INTO playlists (context_id, title, slug, position) SELECT NULL, 'x', 'x', 1 WHERE false",
    "CREATE TABLE pipeline_should_not_exist (id int)",
]


def apply_grants(cur, role, dbname):
    r = sql.Identifier(role)
    cur.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(sql.Identifier(dbname), r))
    cur.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(r))
    cur.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {}").format(r))  # idempotência: parte do zero
    for table, privs in GRANTS:
        cur.execute(sql.SQL("GRANT {} ON {} TO {}").format(
            sql.SQL(", ").join(sql.SQL(p) for p in privs), sql.Identifier(table), r))
    for table, priv, cols in COLUMN_GRANTS:
        cur.execute(sql.SQL("GRANT {} ({}) ON {} TO {}").format(
            sql.SQL(priv), sql.SQL(", ").join(sql.Identifier(c) for c in cols), sql.Identifier(table), r))


def verify(url):
    """Conecta COMO a role e confere o que ela pode e não pode fazer. Devolve lista de problemas."""
    problems = []
    for stmt in SHOULD_WORK:
        with psycopg.connect(url) as conn:
            try:
                conn.execute(stmt)
            except psycopg.Error as e:
                problems.append(f"deveria funcionar e falhou: {stmt} ({type(e).__name__})")
    for stmt in SHOULD_FAIL:
        with psycopg.connect(url) as conn:
            try:
                conn.execute(stmt)
                problems.append(f"deveria ser NEGADO e funcionou: {stmt}")
            except psycopg.errors.InsufficientPrivilege:
                pass
            except psycopg.Error as e:
                problems.append(f"falhou por outro motivo: {stmt} ({type(e).__name__})")
    return problems


def role_url(admin_url, role, password):
    u = urlsplit(admin_url)
    host = u.hostname or "localhost"
    port = f":{u.port}" if u.port else ""
    return f"postgres://{quote(role)}:{quote(password, safe='')}@{host}{port}{u.path}" + (f"?{u.query}" if u.query else "")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--admin-url", default=os.environ.get("DATABASE_URL_ADMIN") or os.environ.get("DATABASE_URL"))
    ap.add_argument("--role", default=DEFAULT_ROLE)
    ap.add_argument("--rotate", action="store_true", help="troca a senha de uma role existente")
    ap.add_argument("--env-file", help="onde gravar a URL (padrão: PIPELINE_DATA_DIR/pipeline-db.env)")
    ap.add_argument("--print-url", action="store_true", help="imprime a URL com a senha (cuidado)")
    a = ap.parse_args(argv)
    if not a.admin_url:
        sys.exit("informe --admin-url (ou DATABASE_URL_ADMIN)")

    with psycopg.connect(a.admin_url, autocommit=True) as conn:
        cur = conn.cursor()
        dbname = conn.info.dbname
        exists = cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (a.role,)).fetchone() is not None
        password = None
        if not exists or a.rotate:
            password = secrets.token_urlsafe(32)
            verb = "ALTER" if exists else "CREATE"
            cur.execute(sql.SQL(verb + " ROLE {} WITH LOGIN PASSWORD {} NOSUPERUSER NOCREATEDB NOCREATEROLE "
                                "NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5").format(
                sql.Identifier(a.role), sql.Literal(password)))
        apply_grants(cur, a.role, dbname)

    print(f"role {a.role!r} {'criada' if not exists else ('senha trocada' if a.rotate else 'já existia')}; permissões aplicadas.")
    if password:
        url = role_url(a.admin_url, a.role, password)
        env_file = Path(a.env_file) if a.env_file else data_dir() / "pipeline-db.env"
        env_file.parent.mkdir(parents=True, exist_ok=True)
        env_file.write_text(f"PIPELINE_DATABASE_URL={url}\n")
        env_file.chmod(0o600)
        print(f"URL de conexão gravada em {env_file} (modo 600). A senha não é impressa.")
        if a.print_url:
            print(url)
        problems = verify(url)
    else:
        print("senha não alterada (use --rotate para trocar); verificação das permissões pulada: "
              "rode com --rotate ou use o teste de integração.")
        problems = []
    for p in problems:
        print("PROBLEMA:", p)
    if password and not problems:
        print(f"verificação ok: {len(SHOULD_WORK)} operações permitidas, {len(SHOULD_FAIL)} negadas como esperado.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
