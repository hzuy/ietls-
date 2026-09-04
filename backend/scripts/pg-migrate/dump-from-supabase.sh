#!/usr/bin/env bash
# dump-from-supabase.sh — pg_dump database Supabase hiện tại ra 1 file custom-format
# (.dump), dùng làm nguồn cho restore-to-local.sh khi cutover sang self-hosted Postgres.
#
# AN TOÀN THEO MẶC ĐỊNH: không tự chạm Supabase nếu không truyền gì thêm ngoài
# --dry-run — script này CHỈ nên chạy thật lần đầu sau khi đã xác nhận với người
# dùng (xem docs/deploy/self-hosted-postgres-migration.md, Giai đoạn 2).
#
# Nguồn kết nối (ưu tiên theo thứ tự):
#   1. Tham số --source-url "postgresql://..."
#   2. Biến môi trường SOURCE_DATABASE_URL
#   3. Đọc DIRECT_URL từ backend/.env (mặc định) — CỐ Ý dùng DIRECT_URL (port 5432,
#      session mode) chứ không phải DATABASE_URL (port 6543, pgbouncer transaction
#      mode) — pg_dump cần kết nối session-level, pgbouncer transaction pooling sẽ
#      làm pg_dump lỗi hoặc thiếu dữ liệu ngẫu nhiên. Xem docs/deploy/db-connection-checklist.md.
#
# Không bao giờ echo password ra log — mọi dòng in URL đều được che (sed mask).
#
# Cách dùng:
#   ./dump-from-supabase.sh --dry-run                    # chỉ in lệnh, không chạy
#   ./dump-from-supabase.sh                               # chạy thật, dùng DIRECT_URL từ backend/.env
#   ./dump-from-supabase.sh --source-url "postgresql://..." --out-dir /home/huuduy/pg-backups
#
# Output: <out-dir>/supabase-<timestamp>.dump  (custom format, nén sẵn, dùng cho pg_restore)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

DRY_RUN=0
SOURCE_URL="${SOURCE_DATABASE_URL:-}"
OUT_DIR="$SCRIPT_DIR/dumps"

log() { echo "[dump-from-supabase] $*"; }
mask() { sed -E 's#(://[^:]+:)[^@]+@#\1***@#'; }
die() { echo "[dump-from-supabase] LỖI: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --source-url) SOURCE_URL="$2"; shift 2 ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Tham số không nhận diện được: $1 (dùng --help)" ;;
  esac
done

# ── Bước 1: xác định connection string nguồn ────────────────────────────────
if [[ -z "$SOURCE_URL" ]]; then
  [[ -f "$ENV_FILE" ]] || die "Không tìm thấy $ENV_FILE và không có --source-url/SOURCE_DATABASE_URL"
  SOURCE_URL="$(grep -E '^DIRECT_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
  [[ -n "$SOURCE_URL" ]] || die "Không đọc được DIRECT_URL từ $ENV_FILE — truyền --source-url thay thế"
  log "Dùng DIRECT_URL từ $ENV_FILE: $(echo "$SOURCE_URL" | mask)"
else
  log "Dùng --source-url / SOURCE_DATABASE_URL: $(echo "$SOURCE_URL" | mask)"
fi

# ── Bước 2: chuẩn bị output ──────────────────────────────────────────────────
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$OUT_DIR/supabase-${TIMESTAMP}.dump"

log "File output sẽ là: $OUT_FILE"
log "Format: custom (-Fc), nén sẵn — dùng cho pg_restore, KHÔNG phải psql < file"

# ── Bước 3: build lệnh pg_dump ───────────────────────────────────────────────
# --no-owner --no-privileges: Supabase dùng role riêng (supabase_admin, postgres.xxx...)
#   không tồn tại trên Postgres local self-hosted → bỏ owner/ACL, restore xong tự set
#   lại owner theo user Postgres local (xem restore-to-local.sh).
# --exclude-schema=... : Supabase có sẵn các schema hệ thống (auth, storage, realtime,
#   extensions, graphql, ...) mà app không dùng (app chỉ dùng "public" qua Prisma) —
#   loại các schema đó để dump gọn và tránh lỗi restore vì thiếu extension tương ứng.
PG_DUMP_CMD=(
  pg_dump
  "$SOURCE_URL"
  -Fc
  --no-owner
  --no-privileges
  --exclude-schema=auth
  --exclude-schema=storage
  --exclude-schema=realtime
  --exclude-schema=graphql
  --exclude-schema=graphql_public
  --exclude-schema=extensions
  --exclude-schema=supabase_functions
  --exclude-schema=supabase_migrations
  --exclude-schema=vault
  --exclude-schema=pgsodium
  --exclude-schema=pgbouncer
  -v
  -f "$OUT_FILE"
)

if [[ $DRY_RUN -eq 1 ]]; then
  log "DRY-RUN — lệnh SẼ chạy (password đã che):"
  printf '  %s\n' "${PG_DUMP_CMD[@]}" | mask
  log "DRY-RUN xong — KHÔNG có gì được thực thi, KHÔNG chạm Supabase."
  exit 0
fi

command -v pg_dump >/dev/null 2>&1 || die "Không tìm thấy pg_dump trong PATH (cần cài postgresql-client, khớp major version với image postgres:16 trong docker-compose.yml)"

mkdir -p "$OUT_DIR"

log "Bắt đầu pg_dump thật — CHẠM SUPABASE THẬT (chỉ đọc, không ghi gì vào Supabase)..."
"${PG_DUMP_CMD[@]}"

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
log "Hoàn tất. File: $OUT_FILE ($SIZE)"
log "Bước tiếp theo: kiểm tra nhanh bằng 'pg_restore -l $OUT_FILE | head -30' rồi mới restore-to-local.sh"
