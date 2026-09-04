# P9 — Self-host Postgres cho production (thay Supabase)

> **Trạng thái: Giai đoạn 1 xong (chuẩn bị). Giai đoạn 2 (cutover thật) CHƯA chạy —
> cần người dùng review và xác nhận từng bước trước khi động vào Supabase thật hoặc
> đổi `DATABASE_URL`/`DIRECT_URL` production.**

## 0. Vì sao

Hiện tại backend production (lab46) và dev local dùng chung 1 Supabase Postgres
(project ref `qtuzysaqftzmveyvrzxz`, region `ap-southeast-2` — `DATABASE_URL` qua
pooler port 6543 `?pgbouncer=true`, `DIRECT_URL` port 5432 dùng cho migration).
Mục tiêu P9: chuyển sang Postgres tự host trên chính lab46 (container
`postgres-prod` trong `docker-compose.yml`), giảm phụ thuộc dịch vụ ngoài + tránh
giới hạn free-tier Supabase.

## 1. Đã chuẩn bị ở Giai đoạn 1 (KHÔNG chạm Supabase thật, KHÔNG deploy)

| Việc | File | Trạng thái |
|---|---|---|
| Service Postgres mới trong compose | `docker-compose.yml` — service `postgres-prod` | Chỉ nằm trong repo, **chưa** `docker compose up` trên lab46 |
| Script dump từ Supabase | `backend/scripts/pg-migrate/dump-from-supabase.sh` | Viết xong, test bằng `--dry-run`, **chưa chạy thật lần nào** |
| Script restore vào local | `backend/scripts/pg-migrate/restore-to-local.sh` | Viết xong, test bằng `--dry-run`, **chưa chạy thật lần nào** |
| Script backup định kỳ | `backend/scripts/pg-migrate/backup-cron.sh` | Viết xong, test bằng `--dry-run`; **không** tự thêm gì vào crontab thật |
| Ước tính dung lượng DB | Mục 4 dưới đây | Ước tính gián tiếp — xem giới hạn ở mục 4 |

Backend hiện tại **vẫn 100% chạy trên Supabase**, `DATABASE_URL`/`DIRECT_URL` chưa
đổi gì, container `ielts-app-backend` trên lab46 chưa bị restart vì việc này.

### 1.1 Cấu hình `.env` cần thêm trước khi bật `postgres-prod` lần đầu

`docker-compose.yml` đọc 3 biến `POSTGRES_PROD_USER` / `POSTGRES_PROD_PASSWORD` /
`POSTGRES_PROD_DB` để khởi tạo container — **không** lấy từ `backend/.env` (cố ý,
xem cảnh báo mục 6). Cần 1 file `.env` mới ở **ROOT repo** (`/home/huuduy/ielts-app/.env`
trên server, cùng cấp `docker-compose.yml`, khác `backend/.env`):

```bash
# /home/huuduy/ielts-app/.env  (root — tạo mới, gitignored sẵn qua rule **/.env)
POSTGRES_PROD_USER=ielts_app
POSTGRES_PROD_PASSWORD=<mật khẩu mạnh MỚI, KHÔNG dùng lại mật khẩu Supabase — tạo bằng: openssl rand -base64 24>
POSTGRES_PROD_DB=ielts_app
```

File này **chưa tồn tại** trên lab46 — phải tạo thủ công trước khi chạy
`docker compose up -d postgres-prod` lần đầu, nếu không compose sẽ báo thiếu biến
`POSTGRES_PROD_PASSWORD` (không có giá trị mặc định — cố ý, để không lỡ tạo DB với
mật khẩu rỗng/yếu).

## 2. Giai đoạn 2 — Kế hoạch cutover (CHƯA CHẠY — cần xác nhận từng bước)

### Bước 0 — Trước khi bắt đầu
- [ ] Đọc kỹ toàn bộ tài liệu này, xác nhận với người thực hiện (không tự động chạy).
- [ ] Chọn thời điểm ít người dùng nhất (đồ án cá nhân, traffic thấp — không bắt buộc phải là nửa đêm, nhưng nên tránh giờ đang có người làm bài thi).
- [ ] Backup `.env` hiện tại: `cp .env ~/ielts-env.bak.$(date +%F-%H%M)` — lưu ở
      `~/`, ngoài repo (`.env.bak.*` không khớp rule `.env` trong `.gitignore`).

### Bước 1 — Đo dung lượng DB thật (LẦN ĐẦU CHẠM SUPABASE THẬT — cần xác nhận riêng)
Đây là hành động **đọc, không ghi**, an toàn, nhưng vẫn là lần đầu thực sự kết nối
Supabase trong P9 nên cần xác nhận trước khi chạy:
```bash
psql "$DIRECT_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```
So với ước tính ở mục 4 để biết disk cần chuẩn bị trên lab46 có đủ không.

### Bước 2 — Bật `postgres-prod` trên lab46 (chưa có dữ liệu thật, an toàn)
```bash
# Trên lab46, trong /home/huuduy/ielts-app
# (đã tạo .env root theo mục 1.1)
docker compose up -d postgres-prod
docker compose ps postgres-prod        # đợi tới khi Health = healthy
```
Bước này **không đụng** container `ielts-app-backend` đang chạy (không có
`depends_on`, không network alias nào khác trỏ vào).

### Bước 3 — Dump từ Supabase (LẦN ĐẦU CHẠM SUPABASE THẬT ở mức ghi-ra-file)
```bash
cd /home/huuduy/ielts-app/backend/scripts/pg-migrate
./dump-from-supabase.sh --dry-run          # xem lại lệnh 1 lần nữa
./dump-from-supabase.sh --out-dir /home/huuduy/pg-backups
```
Kiểm tra nhanh file dump trước khi restore:
```bash
pg_restore -l /home/huuduy/pg-backups/supabase-<timestamp>.dump | head -30
```

### Bước 4 — Restore vào `postgres-prod`
```bash
./restore-to-local.sh --dry-run --file /home/huuduy/pg-backups/supabase-<timestamp>.dump
./restore-to-local.sh --file /home/huuduy/pg-backups/supabase-<timestamp>.dump
```

### Bước 5 — Verify dữ liệu khớp
So sánh số dòng của vài bảng lớn/quan trọng giữa Supabase và `postgres-prod`
(KHÔNG cần so hết 28 bảng — ưu tiên các bảng có FK phức tạp và bảng lớn nhất):

```bash
# Trên Supabase (qua DIRECT_URL)
psql "$DIRECT_URL" -c 'SELECT count(*) FROM "User";'
psql "$DIRECT_URL" -c 'SELECT count(*) FROM "Attempt";'
psql "$DIRECT_URL" -c 'SELECT count(*) FROM "Question";'
psql "$DIRECT_URL" -c 'SELECT count(*) FROM "QuestionAnswer";'
psql "$DIRECT_URL" -c 'SELECT count(*) FROM "Exam";'

# Trên postgres-prod local (qua docker exec, không cần psql host)
docker compose exec postgres-prod psql -U ielts_app -d ielts_app -c 'SELECT count(*) FROM "User";'
docker compose exec postgres-prod psql -U ielts_app -d ielts_app -c 'SELECT count(*) FROM "Attempt";'
docker compose exec postgres-prod psql -U ielts_app -d ielts_app -c 'SELECT count(*) FROM "Question";'
docker compose exec postgres-prod psql -U ielts_app -d ielts_app -c 'SELECT count(*) FROM "QuestionAnswer";'
docker compose exec postgres-prod psql -U ielts_app -d ielts_app -c 'SELECT count(*) FROM "Exam";'
```
Mọi cặp số phải khớp tuyệt đối. Nếu lệch — **KHÔNG cutover**, quay lại Bước 3
(dump lại — có thể do dữ liệu thay đổi giữa lúc dump và lúc verify nếu app vẫn
đang chạy ghi vào Supabase; cân nhắc dừng ghi tạm thời trước khi dump lần cuối,
xem "Downtime" bên dưới).

### Bước 6 — Cutover thật (đổi `.env`, restart backend — ĐIỂM KHÔNG QUAY LẠI DỄ DÀNG)
```bash
cd /home/huuduy/ielts-app/backend
cp .env ~/ielts-env.bak.$(date +%F-%H%M)     # backup, giống checklist P5

# Sửa .env: đổi DATABASE_URL + DIRECT_URL trỏ postgres-prod (nội bộ docker network)
# DATABASE_URL="postgresql://ielts_app:<POSTGRES_PROD_PASSWORD>@postgres-prod:5432/ielts_app"
# DIRECT_URL="postgresql://ielts_app:<POSTGRES_PROD_PASSWORD>@postgres-prod:5432/ielts_app"
# (Postgres tự host không cần pgbouncer/pooler params — bỏ ?pgbouncer=true&connection_limit=...)

cd /home/huuduy/ielts-app
# Thêm depends_on: postgres-prod vào service backend trong docker-compose.yml
# TRƯỚC bước này (sửa trong repo, git pull về server) — xem mục 1 docker-compose.yml
docker compose up -d backend      # restart backend với .env mới

docker logs -f --tail 50 ielts-app-backend
# Không có "Can't reach database server" / lỗi Prisma
curl -s -o /dev/null -w '%{http_code}\n' https://hzuy.net/api/practice/reading   # phải 200
```

### Bước 7 — Theo dõi 24–48h
- [ ] Log backend sạch, không lỗi kết nối DB rải rác.
- [ ] Test thử 1 lượt thi đầy đủ (Reading/Listening/Writing/Speaking) qua UI thật.
- [ ] Bật `backup-cron.sh` qua crontab (mục 3 dưới).
- [ ] Sau 48h ổn định — có thể tắt/xoá kết nối tới Supabase (hạ cấp hoặc xoá project trên dashboard Supabase) để dừng tính phí, nếu có.

### Downtime cần thiết
- Bước 1–5 (đo, dump, restore, verify): **0 downtime** — Supabase vẫn phục vụ backend bình thường trong lúc này, chỉ đọc.
- Bước 6 (đổi `.env` + restart backend container): **downtime thực tế = thời gian `docker compose up -d backend` khởi động lại** — thường 5–15 giây (container Node đơn, không cần warm-up dài) + độ trễ health-check của Nginx/Cloudflare. Ước tính **dưới 1 phút**.
- Rủi ro lệch dữ liệu: nếu có người dùng ghi vào Supabase **giữa lúc dump (Bước 3) và lúc restart (Bước 6)**, những ghi đó **sẽ mất** sau cutover (vì backend chuyển sang đọc DB mới, không đồng bộ ngược). Vì app cho phép người dùng làm bài/nộp bài liên tục, cách an toàn nhất là dump lại **ngay trước** Bước 6 (dump lần 2, sát giờ cutover) thay vì dùng dump từ nhiều giờ trước, hoặc thông báo tạm dừng vài phút nếu có người đang làm bài.

## 3. Backup định kỳ sau cutover (hướng dẫn crontab — KHÔNG tự thêm)

Sau khi cutover xong và ổn định, thêm dòng sau vào crontab của user `huuduy` trên
lab46 (`crontab -e`) — chạy 2h sáng mỗi ngày, giữ 14 ngày gần nhất:

```cron
0 2 * * * cd /home/huuduy/ielts-app && POSTGRES_PROD_PASSWORD=$(grep '^POSTGRES_PROD_PASSWORD=' .env | cut -d= -f2-) backend/scripts/pg-migrate/backup-cron.sh --out-dir /home/huuduy/pg-backups --retention-days 14 >> /home/huuduy/pg-backups/backup-cron.log 2>&1
```

- Lưu **local trên lab46** (`/home/huuduy/pg-backups`), **không** đẩy đi nơi khác — theo quyết định đã chọn cho giai đoạn này.
- `/home/huuduy/pg-backups` không nằm trong `docker-compose.yml`/không bị container nào mount — không có vấn đề SELinux vì đây chỉ là file host thường (ghi qua stdout redirect, không phải bind-mount cho container đọc).
- Nên `mkdir -p /home/huuduy/pg-backups && chmod 700 /home/huuduy/pg-backups` trước (chứa dữ liệu người dùng thật, chỉ user sở hữu đọc được).

## 4. Ước tính dung lượng DB hiện tại (gián tiếp — CHƯA đo trực tiếp)

Theo yêu cầu P9 giai đoạn 1: **không tự kết nối Supabase** để đo, kể cả bằng
query read-only — số đo chính xác sẽ lấy ở Bước 1 của Giai đoạn 2. Ước tính gián
tiếp dưới đây chỉ để lên kế hoạch disk sơ bộ:

- Schema: 28 model Prisma (`backend/prisma/schema.prisma`), 16 migration.
- Ảnh/audio (cover, thumbnail, RichText images, audio bài Speaking) **không** nằm
  trong Postgres — lưu ở `backend/uploads/` (hiện ~111 MB trên máy local, không
  tính vào dung lượng DB cần dump/restore).
- Quy mô: đồ án tốt nghiệp cá nhân, không phải sản phẩm nhiều người dùng đồng thời
  — số dòng `User`/`Attempt`/`QuestionAnswer` nhiều khả năng ở mức hàng trăm tới
  thấp hàng chục nghìn dòng, không phải hàng triệu.
- **Ước tính sơ bộ: dung lượng DB (không tính uploads) nhiều khả năng dưới 200–300 MB.**
  Đây là ước tính định tính, không phải số đo — coi là cận dưới để lên kế hoạch,
  **bắt buộc đo lại bằng Bước 1 (Giai đoạn 2) trước khi quyết định dung lượng ổ đĩa
  thật trên lab46.**
- Disk cần chuẩn bị trên lab46 cho named volume `postgres_prod_data`: khuyến nghị
  tối thiểu **2–5 GB** (đủ dư cho DB + WAL + vài bản backup cục bộ + margin tăng
  trưởng), dù ước tính thật có thể nhỏ hơn nhiều — chưa biết disk trống hiện có
  trên lab46 nên chưa thể khẳng định đủ hay không; kiểm tra bằng `df -h /` trên
  lab46 trước Bước 2.
- Thời gian dump/restore ước tính: với quy mô dưới 300 MB qua kết nối Internet
  bình thường, `pg_dump` (đọc từ Supabase) nhiều khả năng dưới 1–2 phút;
  `pg_restore` (ghi vào Postgres local, cùng máy) còn nhanh hơn. Không phải yếu
  tố quyết định thời gian downtime (xem mục 2, Bước 6 mới là downtime thật).

## 5. Rollback về Supabase nếu có vấn đề sau cutover

Nếu sau Bước 6 phát hiện lỗi (mất dữ liệu, sai kết nối, lỗi ứng dụng không rõ
nguyên nhân liên quan DB):

```bash
cd /home/huuduy/ielts-app/backend
cp ~/ielts-env.bak.<ngày-giờ-đã-backup-ở-Bước-0> .env    # khôi phục DATABASE_URL/DIRECT_URL trỏ lại Supabase

cd /home/huuduy/ielts-app
docker compose up -d backend
docker logs -f --tail 50 ielts-app-backend
```

- Rollback bằng cách đổi `.env` là **an toàn và tức thời** MIỄN LÀ Supabase project
  chưa bị tạm dừng/xoá — vì vậy đừng hạ cấp hay xoá Supabase project ngay sau
  cutover; giữ nguyên ít nhất 1–2 tuần làm phương án dự phòng.
- Lưu ý: nếu rollback SAU KHI đã có ghi dữ liệu mới vào `postgres-prod` (người
  dùng làm bài sau cutover), rollback về Supabase sẽ làm **mất** những ghi đó
  (Supabase không tự đồng bộ ngược từ `postgres-prod`). Rollback chỉ thật sự
  "miễn phí" nếu thực hiện **trong vài phút đầu** sau Bước 6, trước khi có dữ
  liệu mới ghi vào DB mới.

## 6. Sự cố đã gặp khi chuẩn bị (rút kinh nghiệm)

Trong lúc soạn `docker-compose.yml` ở Giai đoạn 1, bản nháp đầu tiên có gắn
`env_file: ./backend/.env` vào service `postgres-prod` (nghĩ là tiện, nạp sẵn
biến môi trường). Khi chạy `docker compose config` để kiểm tra cú pháp, lệnh đó
**in ra màn hình toàn bộ `DATABASE_URL` (kèm password), `JWT_SECRET`,
`GROQ_API_KEY` thật** — vì `env_file` nạp *toàn bộ* `backend/.env`, không chỉ 3
biến `POSTGRES_PROD_*` cần thiết. Đã sửa: bỏ `env_file` khỏi `postgres-prod`,
chỉ khai đúng 3 biến qua `environment:` + nội suy `${POSTGRES_PROD_*}` từ `.env`
gốc riêng (mục 1.1). Bài học: **không gắn `env_file` trỏ vào 1 file `.env` dùng
chung cho nhiều service nếu service đó không cần hết các biến trong file** —
luôn giới hạn đúng biến cần thiết.

**Khuyến nghị cho người dùng:** vì `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`
thật đã hiển thị ra output trong quá trình chuẩn bị P9 (dù không commit vào
repo), nên cân nhắc xoay (rotate) `JWT_SECRET` và `GROQ_API_KEY` production sau
khi review xong tài liệu này, để chắc chắn an toàn — đây là quyết định của
người dùng, không tự động thực hiện.
