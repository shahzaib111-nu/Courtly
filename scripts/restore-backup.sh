#!/usr/bin/env bash
# Restores the Courtly database from a backup made by BackupService (NFR 3.3.1).
#
#   1. Stop the backend first.
#   2. ./scripts/restore-backup.sh backups/courtly-backup-YYYYMMDD-HHMMSS.zip
#      (encrypted .enc backups: add the backup password as the second argument)
#   3. Start the backend again.
#
# The current database is kept as database/courtlydb.mv.db.before-restore-<time>.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="${1:-}"
PASSWORD="${2:-}"
DB_DIR="$ROOT/database"
DB_FILE="$DB_DIR/courtlydb.mv.db"

if [[ -z "$BACKUP" || ! -f "$BACKUP" ]]; then
  echo "Usage: $0 <backup .zip> [backup password]"
  echo "Available backups:"; ls -1t "$ROOT"/backups/courtly-backup-*  2>/dev/null || echo "  (none in $ROOT/backups)"
  exit 1
fi
BACKUP="$(cd "$(dirname "$BACKUP")" && pwd)/$(basename "$BACKUP")"

# The H2 jar the application itself uses, so the restored file has the right format
CP_FILE="$(mktemp)"
(cd "$ROOT/src/backend" && ./mvnw -q dependency:build-classpath -DincludeArtifactIds=h2 -Dmdep.outputFile="$CP_FILE")
H2_JAR="$(cat "$CP_FILE")"; rm -f "$CP_FILE"
[[ -f "$H2_JAR" ]] || { echo "Could not find the H2 jar"; exit 1; }

mkdir -p "$DB_DIR"
if [[ -f "$DB_FILE" ]]; then
  SAVED="$DB_FILE.before-restore-$(date +%Y%m%d-%H%M%S)"
  mv "$DB_FILE" "$SAVED"
  echo "Current database moved to $SAVED"
fi

if [[ "$BACKUP" == *.enc ]]; then
  [[ -n "$PASSWORD" ]] || { echo "This backup is encrypted: pass the backup password (app.backup.password)"; exit 1; }
  OPTIONS="COMPRESSION DEFLATE CIPHER AES PASSWORD '${PASSWORD//\'/\'\'}'"
else
  OPTIONS="COMPRESSION ZIP"
fi

java -cp "$H2_JAR" org.h2.tools.RunScript \
  -url "jdbc:h2:file:$DB_DIR/courtlydb" -user sa -password "" \
  -script "$BACKUP" -options "$OPTIONS"

echo "Restored $BACKUP into $DB_DIR/courtlydb. Start the backend again."
