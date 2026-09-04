#!/usr/bin/env bash
# backup-cron.sh — pg_dump định kỳ database postgres-prod (self-hosted, sau khi
# cutover) ra file .dump có timestamp, lưu LOCAL trên lab46 (không đẩy đi nơi
# khác — theo quyết định đã chọn cho giai đoạn này). Script này KHÔNG tự thêm gì
# vào crontab — chỉ thực thi 1 lần khi được gọi; hướng dẫn thêm crontab nằm ở
# docs/deploy/self-hosted-postgres-migration.md.
#
# CHỈ CÓ TÁC DỤNG SAU KHI CUTOVER — script kết nối vào service "postgres-prod"
# qua docker compose exec. Trước khi cutover (backend vẫn dùng Supabase),
# --dry-run vẫn chạy được nhưng chạy thật sẽ lỗi vì "postgres-prod" chưa có dữ
# liệu thật/chưa được backend sử dụng.
#
# Cách dùng:
#   ./backup-cron.sh --dry-run
#   ./backup-cron.sh                                  # dùng default: /home/huuduy/pg-backups, giữ 14 ngày
#   ./backup-cron.sh --out-dir /home/huuduy/pg-backups --retention-days 14
#
# Output: <out-dir>/postgres-prod-<timestamp>.dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ROOT_ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

DRY_RUN=0
SERVICE="postgres-prod"
OUT_DIR="${BACKUP_OUT_DIR:-$HOME/pg-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PG_USER="${POSTGRES_PROD_USER:-}"
PG_PASSWORD="${POSTGRES_PROD_PASSWORD:-}"
PG_DB="${POSTGRES_PROD_DB:-}"

log() { echo "[backup-cron] $(date '+%Y-%m-%d %H:%M:%S') $*"; }
die() { echo "[backup-cron] $(date '+%Y-%m-%d %H:%M:%S') LỖI: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Tham số không nhận diện được: $1 (dùng --help)" ;;
  esac
done

if [[ -z "$PG_USER" || -z "$PG_PASSWORD" || -z "$PG_DB" ]]; then
  if [[ -f "$ROOT_ENV_FILE" ]]; then
    [[ -n "$PG_USER" ]]     || PG_USER="$(grep -E '^POSTGRES_PROD_USER='     "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    [[ -n "$PG_PASSWORD" ]] || PG_PASSWORD="$(grep -E '^POSTGRES_PROD_PASSWORD=' "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    [[ -n "$PG_DB" ]]       || PG_DB="$(grep -E '^POSTGRES_PROD_DB='       "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
  fi
  PG_USER="${PG_USER:-ielts_app}"
  PG_DB="${PG_DB:-ielts_app}"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/postgres-prod-${TIMESTAMP}.dump"

log "Config: service=$SERVICE user=$PG_USER db=$PG_DB out-dir=$OUT_DIR retention-days=$RETENTION_DAYS"

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY-RUN — sẽ chạy:"
  echo "  mkdir -p $OUT_DIR"
  echo "  docker compose -f $COMPOSE_FILE exec -T -e PGPASSWORD=*** $SERVICE pg_dump -U $PG_USER -Fc $PG_DB > $OUT_FILE"
  echo "  find $OUT_DIR -name 'postgres-prod-*.dump' -mtime +$RETENTION_DAYS -delete"
  log "DRY-RUN xong — KHÔNG có gì được thực thi."
  exit 0
fi

[[ -n "$PG_PASSWORD" ]] || die "Thiếu POSTGRES_PROD_PASSWORD (đặt trong .env gốc, hoặc biến môi trường — vd. trong dòng crontab)"
command -v docker >/dev/null 2>&1 || die "Không tìm thấy docker trong PATH"

mkdir -p "$OUT_DIR"

log "Bắt đầu pg_dump từ $SERVICE..."
docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$PG_PASSWORD" "$SERVICE" \
  pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$OUT_FILE"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
log "Backup xong: $OUT_FILE ($SIZE)"

log "Dọn backup cũ hơn $RETENTION_DAYS ngày trong $OUT_DIR..."
DELETED_COUNT="$(find "$OUT_DIR" -name 'postgres-prod-*.dump' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
log "Đã xoá $DELETED_COUNT file backup cũ."

log "Hoàn tất."
