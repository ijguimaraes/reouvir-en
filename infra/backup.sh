#!/usr/bin/env bash
# Backup do banco (pg_dump) e da pasta de áudio (regenerar custa créditos do ElevenLabs).
# Uso: BACKUP_DIR=/mnt/outro-disco/reouvir ./infra/backup.sh      (agende no cron, ex.: diário às 3h)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:?defina BACKUP_DIR (de preferência em outro disco)}"
KEEP_DAYS="${KEEP_DAYS:-14}"
cd "$(dirname "$0")/.."
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.yml)
set -a; . ./.env; set +a

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/audio"
stamp="$(date +%Y%m%d-%H%M%S)"

"${COMPOSE[@]}" exec -T postgres pg_dump -U "${POSTGRES_USER:-reouvir}" "${POSTGRES_DB:-reouvir}" | gzip > "$BACKUP_DIR/db/reouvir-$stamp.sql.gz"
find "$BACKUP_DIR/db" -name 'reouvir-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

# Espelho do volume de áudio (os arquivos nunca mudam, então só acumula).
"${COMPOSE[@]}" exec -T api tar -C /data/audio -cf - . | tar -C "$BACKUP_DIR/audio" -xf - --skip-old-files
echo "Backup concluído em $BACKUP_DIR ($stamp)"
