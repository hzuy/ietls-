#!/usr/bin/env bash
# restore-to-local.sh — restore 1 file .dump (tạo bởi dump-from-supabase.sh) vào
# service postgres-prod (self-hosted, chạy trong docker compose, KHÔNG map port ra
# host — xem docker-compose.yml). Restore đi qua `docker compose exec`, không cần
# psql/pg_restore cài trên host.
#
# AN TOÀN THEO MẶC ĐỊNH: --dry-run chỉ in lệnh. Script mặc định KHÔNG --clean nên
# sẽ LỖI nếu database đích không rỗng (an toàn hơn là âm thầm ghi đè) — dùng
# --clean khi cố ý muốn xoá sạch rồi restore lại (vd. thử lại sau lần restore lỗi).
#
# Nguồn mật khẩu/thông tin kết nối: đọc POSTGRES_PROD_USER / POSTGRES_PROD_PASSWORD /
# POSTGRES_PROD_DB từ file .env ở ROOT repo (cùng cấp docker-compose.yml — KHÔNG
# phải backend/.env), đúng biến docker-compose.yml dùng để khởi tạo container. Có
# thể override qua tham số dòng lệnh hoặc biến môi trường.
#
# Cách dùng (chạy trên lab46, cùng thư mục có docker-compose.yml):
#   ./restore-to-local.sh --dry-run --file dumps/supabase-20260905-020000.dump
#   ./restore-to-local.sh --file /home/huuduy/pg-backups/supabase-20260905-020000.dump
#   ./restore-to-local.sh --file <path> --clean   # xoá sạch DB đích trước khi restore
#
# Yêu cầu: service "postgres-prod" đã `docker compose up -d postgres-prod` và
# healthcheck đã pass (script tự đợi tối đa 60s).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ROOT_ENV_FILE="$REPO_ROOT/.env"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

DRY_RUN=0
DUMP_FILE=""
CLEAN=0
SERVICE="postgres-prod"
PG_USER="${POSTGRES_PROD_USER:-}"
PG_PASSWORD="${POSTGRES_PROD_PASSWORD:-}"
PG_DB="${POSTGRES_PROD_DB:-}"

log() { echo "[restore-to-local] $*"; }
die() { echo "[restore-to-local] LỖI: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --file) DUMP_FILE="$2"; shift 2 ;;
    --clean) CLEAN=1; shift ;;
    --user) PG_USER="$2"; shift 2 ;;
    --password) PG_PASSWORD="$2"; shift 2 ;;
    --db) PG_DB="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Tham số không nhận diện được: $1 (dùng --help)" ;;
  esac
done

[[ -n "$DUMP_FILE" ]] || die "Thiếu --file <đường-dẫn-file-.dump>"
[[ -f "$DUMP_FILE" ]] || die "Không tìm thấy file: $DUMP_FILE"

# ── Bước 1: nạp POSTGRES_PROD_* từ .env gốc nếu chưa có qua tham số/env ─────
if [[ -z "$PG_USER" || -z "$PG_PASSWORD" || -z "$PG_DB" ]]; then
  if [[ -f "$ROOT_ENV_FILE" ]]; then
    [[ -n "$PG_USER" ]]     || PG_USER="$(grep -E '^POSTGRES_PROD_USER='     "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    [[ -n "$PG_PASSWORD" ]] || PG_PASSWORD="$(grep -E '^POSTGRES_PROD_PASSWORD=' "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
    [[ -n "$PG_DB" ]]       || PG_DB="$(grep -E '^POSTGRES_PROD_DB='       "$ROOT_ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
  fi
  PG_USER="${PG_USER:-ielts_app}"
  PG_DB="${PG_DB:-ielts_app}"
fi
[[ -n "$PG_PASSWORD" ]] || die "Thiếu POSTGRES_PROD_PASSWORD (đặt trong .env gốc, hoặc --password, hoặc biến môi trường)"

log "Target: service=$SERVICE user=$PG_USER db=$PG_DB file=$DUMP_FILE clean=$CLEAN"

# ── Bước 2: build lệnh ────────────────────────────────────────────────────
# --no-owner --no-privileges: khớp với cách dump-from-supabase.sh đã dump (owner
#   Supabase không tồn tại ở đây); container postgres-prod tự set owner = PG_USER.
# KHÔNG dùng -j (parallel restore): pg_restore từ chối "-j" khi input là stdin
#   ("parallel restore from standard input is not supported") — cách stream
#   `docker compose exec -T ... < $DUMP_FILE` ở dưới đưa file vào qua stdin của
#   container, không phải path file trực tiếp. Restore tuần tự (single job) đủ
#   nhanh cho quy mô DB hiện tại (dump ~4MB, dưới 30 giây — xem báo cáo P9
#   Giai đoạn 2). Nếu sau này DB lớn hơn nhiều, đổi sang `docker cp` file vào
#   container rồi pg_restore trực tiếp theo path để dùng lại được -j.
PG_RESTORE_ARGS=(--no-owner --no-privileges -U "$PG_USER" -d "$PG_DB" -v)
[[ $CLEAN -eq 1 ]] && PG_RESTORE_ARGS+=(--clean --if-exists)

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY-RUN — lệnh SẼ chạy (password không hiện trong lệnh, truyền qua PGPASSWORD env bên trong container):"
  echo "  docker compose -f $COMPOSE_FILE exec -T -e PGPASSWORD=*** $SERVICE pg_restore ${PG_RESTORE_ARGS[*]} < $DUMP_FILE"
  log "DRY-RUN xong — KHÔNG có gì được thực thi."
  exit 0
fi

command -v docker >/dev/null 2>&1 || die "Không tìm thấy docker trong PATH"

# ── Bước 3: đợi postgres-prod healthy ────────────────────────────────────────
log "Đợi service $SERVICE healthy (tối đa 60s)..."
WAITED=0
until docker compose -f "$COMPOSE_FILE" ps "$SERVICE" --format '{{.Health}}' 2>/dev/null | grep -q healthy; do
  WAITED=$((WAITED + 2))
  [[ $WAITED -ge 60 ]] && die "$SERVICE chưa healthy sau 60s — kiểm tra 'docker compose logs $SERVICE'"
  sleep 2
done
log "$SERVICE đã healthy."

# ── Bước 4: restore thật ─────────────────────────────────────────────────────
log "Bắt đầu pg_restore vào $SERVICE (KHÔNG đụng Supabase, chỉ ghi vào container local)..."
docker compose -f "$COMPOSE_FILE" exec -T -e PGPASSWORD="$PG_PASSWORD" "$SERVICE" \
  pg_restore "${PG_RESTORE_ARGS[@]}" < "$DUMP_FILE"

log "Restore xong. Gợi ý verify (xem chi tiết trong docs/deploy/self-hosted-postgres-migration.md):"
log "  docker compose exec $SERVICE psql -U $PG_USER -d $PG_DB -c \"SELECT count(*) FROM \\\"Attempt\\\";\""
log "  so với: SELECT count(*) FROM \"Attempt\"; chạy trên Supabase (qua DIRECT_URL) — phải khớp."
