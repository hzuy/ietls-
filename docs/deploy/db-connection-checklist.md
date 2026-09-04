# P5 — Checklist xác nhận `DATABASE_URL` / `DIRECT_URL` prod

> Chuẩn bị để bạn **tự chạy khi SSH vào `lab46`**. CLI không làm hộ bước SSH nào.
> `.env` thật trên server không có trong repo ⇒ mọi giá trị dưới đây là placeholder.

---

## 1. Bối cảnh

- Trong repo, `backend/.env.example` và `backend/.env.demo` ghi dạng:
  ```
  DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"
  ```
  → **direct connection, port 5432, không có tham số pooler.**
- Nhưng audit 2026-09-04 (đo từ `.env` local, dùng chung DB với prod) cho thấy host thật là:
  ```
  aws-1-ap-southeast-2.pooler.supabase.com:6543   (Supabase pgBouncer, transaction mode)
  ```
- `backend/lib/prisma.js` có comment "pgbouncer transaction mode, connection_limit=1 trong URL"
  — nhưng **không kiểm tra được** URL thật có đúng tham số không.
- `backend/prisma/schema.prisma` khai báo:
  ```prisma
  datasource db {
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
  ⇒ Prisma **bắt buộc** có biến `DIRECT_URL` khi chạy `prisma migrate` / `prisma db push`.

**Mục tiêu:** xác nhận `.env` trên server có đúng 2 biến, đúng tham số. Nếu đã đúng —
ghi lại để khỏi audit lại. Nếu sai — sửa theo mục 3.

### Dạng URL đúng (tham chiếu — KHÔNG phải giá trị thật, tự lấy password/ref từ Supabase dashboard)

```
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
```

- `DATABASE_URL` → **port 6543** (pooler / transaction mode) + `?pgbouncer=true&connection_limit=1&pool_timeout=20`.
  Đây là URL app dùng runtime (nhiều request ngắn).
- `DIRECT_URL` → **port 5432** (session mode, không qua pgBouncer), dùng cho migration/introspection.
  Có thể là `...pooler.supabase.com:5432` (Supabase "session pooler") hoặc `db.<ref>.supabase.co:5432` (direct).
- Lấy chính xác 2 chuỗi này ở: Supabase Dashboard → Project → **Connect** → ORMs / Prisma
  (Supabase in sẵn cả `DATABASE_URL` pooler lẫn `DIRECT_URL`).

---

## 2. Checklist khi SSH vào server

`.env` prod nằm ở: **`/home/huuduy/ielts-app/backend/.env`**
(theo `docker-compose.yml` → `env_file: ./backend/.env`, repo checkout tại `/home/huuduy/ielts-app`).

```bash
ssh lab46
cd /home/huuduy/ielts-app/backend
```

- [ ] **Backup trước khi đụng vào** — lưu RA NGOÀI repo (`~/`), vì `.env.bak.*`
      KHÔNG khớp rule `.env` / `**/.env` trong `.gitignore` (chỉ khớp tên đúng `.env`):
      ```bash
      cp .env ~/ielts-env.bak.$(date +%F-%H%M)
      ```

- [ ] **Xem 2 biến (che bớt password khi dán ra ngoài):**
      ```bash
      grep -E '^DATABASE_URL|^DIRECT_URL' .env | sed -E 's#(://[^:]+:)[^@]+@#\1***@#'
      ```

- [ ] **`DATABASE_URL` — kiểm 4 điểm:**
      - [ ] host là `...pooler.supabase.com` (không phải `db.<ref>.supabase.co`)
      - [ ] port `:6543`
      - [ ] có `?pgbouncer=true`
      - [ ] có `&connection_limit=1` (khuyến nghị thêm `&pool_timeout=20`)

- [ ] **`DIRECT_URL` — tồn tại và:**
      - [ ] có mặt trong `.env` (grep ở trên phải ra 2 dòng, không phải 1)
      - [ ] port `:5432` (KHÁC port của `DATABASE_URL`)
      - [ ] nếu **thiếu hẳn** `DIRECT_URL`: app runtime vẫn chạy (chỉ `DATABASE_URL` được
            dùng lúc serve request), NHƯNG lần tới chạy `npx prisma migrate deploy`
            (từ local hay từ server) sẽ **lỗi** `Environment variable not found: DIRECT_URL`.

- [ ] **Nếu KHÔNG cần sửa gì** → xuống mục 4 ghi chú, xong.

- [ ] **Nếu phải sửa** → làm theo mục 3.

---

## 3. Nếu cần sửa

```bash
cd /home/huuduy/ielts-app/backend
# (đã có ~/ielts-env.bak.* từ mục 2)

nano .env            # sửa/thêm DATABASE_URL + DIRECT_URL theo mẫu mục 1

# nạp lại container backend với .env mới (KHÔNG cần --build, chỉ đổi env)
cd /home/huuduy/ielts-app
docker compose up -d backend

# theo dõi log ~30s xem có lỗi kết nối / lỗi Prisma-pgBouncer không
docker logs -f --tail 50 ielts-app-backend
```

- [ ] Log **KHÔNG** có `Can't reach database server` / `Connection terminated`.
- [ ] Log **KHÔNG** có `prepared statement "s0" already exists` hoặc
      `bind message supplies N parameters` — đây là dấu hiệu Prisma xung đột với
      pgBouncer transaction mode → nghĩa là **thiếu `?pgbouncer=true`** trong `DATABASE_URL`.
- [ ] Test 1 endpoint có chạm DB:
      ```bash
      curl -s -o /dev/null -w '%{http_code} %{time_starttransfer}s\n' https://hzuy.net/api/practice/reading
      # 200, và (nếu cache P1 đã deploy) lần 2 phải ~vài ms
      ```
- [ ] Rollback nếu hỏng:
      ```bash
      cp ~/ielts-env.bak.<ngày-giờ> /home/huuduy/ielts-app/backend/.env
      cd /home/huuduy/ielts-app && docker compose up -d backend
      ```

---

## 4. Ghi chú kết quả (điền sau khi kiểm)

```
Ngày kiểm:        __________
DATABASE_URL:     [ ] đã đúng (pooler:6543 + pgbouncer=true + connection_limit=1)
                  [ ] đã sửa ngày ______ (backup: ~/ielts-env.bak.______)
DIRECT_URL:       [ ] có sẵn, port 5432
                  [ ] đã thêm ngày ______
Log sau restart:  [ ] sạch   [ ] có cảnh báo: __________
```

> Sau khi xác nhận, cập nhật `backend/.env.example` trong repo cho khớp thực tế
> (giữ placeholder, chỉ sửa **dạng** URL) để lần sau không phải audit lại:
>
> ```
> # backend/.env.example — đề xuất
> DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20"
> DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres"
> ```

---

## 5. Rủi ro

| Việc | Rủi ro |
|---|---|
| Sửa sai `DATABASE_URL` (sai host/port/password) | **Toàn site down** — mọi endpoint chạm DB trả 500 ngay khi container restart |
| Bỏ `?pgbouncer=true` khi dùng port 6543 | Lỗi rải rác `prepared statement already exists` dưới tải, khó debug |
| Xoá nhầm `DIRECT_URL` | App vẫn chạy, nhưng `prisma migrate` lần sau fail |
| Quên backup `.env` | Không có đường lùi nhanh |

⇒ **Luôn `cp .env ~/ielts-env.bak.$(date +%F-%H%M)` trước khi mở editor** (lưu ở `~/`,
ngoài repo — `.env.bak.*` KHÔNG khớp `.gitignore` nên nếu để trong `backend/` có thể
bị `git add` nhầm). Xoá bản backup sau khi xác nhận ổn.
