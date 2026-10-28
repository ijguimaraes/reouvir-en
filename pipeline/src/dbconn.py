"""Conexão da pipeline com o Postgres: PIPELINE_DATABASE_URL, direto do ambiente ou de PIPELINE_DATA_DIR/pipeline-db.env."""
import os

from vocab import data_dir


def connection_url():
    url = os.environ.get("PIPELINE_DATABASE_URL")
    env = data_dir() / "pipeline-db.env"
    if not url and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("PIPELINE_DATABASE_URL="):
                url = line.split("=", 1)[1].strip()
    return url
