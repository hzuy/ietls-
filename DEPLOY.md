# DEPLOY.md — Quy trình deploy production

> Runbook cho việc deploy thủ công app IELTS lên server self-hosted (lab46).
> Viết lại sau lần deploy commit `86241c6` (2026-09-04), trong đó gặp và xử lý 3 bẫy
> không hiển nhiên: **SELinux context**, **VITE_API_URL build sai**, và **DB dùng chung
> local/prod**. Lần sau chỉ cần đọc theo checklist, không phải debug lại.
>
> Không có secret / password / connection string thật trong file này. Chỗ nào cần
> nhắc tới thì dùng placeholder (`<DATABASE_URL>`, `<OLD_IMAGE_ID>`, `<FILE>`...).

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Điều kiện tiên quyết (làm 1 lần)](#2-điều-kiện-tiên-quyết-làm-1-lần)
3. [Quy trình deploy từng bước](#3-quy-trình-deploy-từng-bước)
4. [Rollback](#4-rollback)
5. [Lỗi thường gặp — triage nhanh](#5-lỗi-thường-gặp--triage-nhanh)
6. [Việc chưa làm, nên cân nhắc](#6-việc-chưa-làm-nên-cân-nhắc)

---

## 1. Kiến trúc tổng quan

| Thành phần | Chi tiết |
|---|---|
| **Server** | `lab46` — self-hosted, IP `10.100.200.126`, user `huuduy`. |
| **Domain** | `https://hzuy.net`, đứng sau **Cloudflare proxy**. Cloudflare che IP origin → **KHÔNG SSH được qua `hzuy.net`**, phải SSH thẳng vào `lab46` / `10.100.200.126`. |
| **Backend** | Docker container `ielts-app-backend` (`docker-compose.yml` ở root repo). Bind `127.0.0.1:5001` (không mở ra Internet). Nginx trên cùng máy reverse-proxy `/api` và `/uploads` vào container. `PORT=5001`, `NODE_ENV=production`, biến môi trường nạp từ `./backend/.env` trên server. |
| **Frontend** | Static build. Nginx serve trực tiếp từ `/home/huuduy/ielts-app/frontend/dist`. Không chạy qua Node. |
| **Database** | Supabase PostgreSQL managed, project ref `qtuzysaqftzmveyvrzxz`. **Local dev VÀ prod trỏ CHUNG một database này** — không có DB riêng cho local. Migration chạy từ máy local lúc dev thường đã áp lên đúng cái DB mà prod dùng. Xem [bước 9](#bước-9--migration-kiểm-tra-trước-đừng-tự-động-chạy). |
| **CI/CD** | Không có. GitHub Actions chỉ chạy test trên push/PR to `main`, **không tự deploy**. Mọi bước dưới đây là thủ công. |

### Đường đi request

```
Browser ──HTTPS──> Cloudflare ──> Nginx (lab46) ──┬── /            -> /home/huuduy/ielts-app/frontend/dist (static)
                                                  ├── /api/...     -> 127.0.0.1:5001 (container, giữ nguyên prefix /api)
                                                  └── /uploads/...  -> 127.0.0.1:5001
```

> Config Nginx thật (`huuduy.conf` / trong `/etc/nginx/`) **chỉ nằm trên server**, không có trong repo. Nếu cần sửa `root` hay `proxy_pass` thì sửa trực tiếp trên server rồi `sudo nginx -t && sudo systemctl reload nginx`.

---

## 2. Điều kiện tiên quyết (làm 1 lần)

Đã xong, ghi lại để tái lập nếu đổi máy:

- **SSH key** `ed25519` tại `~/.ssh/id_ed25519`, đã `ssh-copy-id` lên server.
- **Alias `lab46`** trong `~/.ssh/config`:

  ```sshconfig
  Host lab46
      HostName 10.100.200.126
      User huuduy
      IdentityFile ~/.ssh/id_ed25519
  ```

- User `huuduy` đã ở trong group `docker` trên server → chạy `docker` / `docker compose` không cần `sudo`.
- Trên server, file `backend/.env` đã có `FRONTEND_URL=https://hzuy.net` — bắt buộc, nếu không domain thật sẽ bị CORS chặn (`server.js` chỉ thêm origin này vào allowlist khi biến tồn tại).
- Node.js **chỉ có ở máy local** — server không cài Node → **frontend luôn build ở local** ([bước 3](#bước-3--build-frontend-tại-local)).

---

## 3. Quy trình deploy từng bước

Checklist thực thi được. Lệnh dựa trên đúng những gì đã chạy thành công ở lần deploy `86241c6`.
Nếu **chỉ đổi frontend** thì bỏ qua bước 8–9. Nếu **chỉ đổi backend** thì bỏ qua bước 3–7.

### Bước 0 — Chạy full test suite trước khi merge

```bash
cd backend && npm run test
```

```bash
cd frontend && npm run test
```

Cả hai phải xanh. Không deploy nếu có test đỏ.

### Bước 1 — Merge branch → `main` và push

```bash
git checkout main
git pull --ff-only
git merge --ff-only <feature-branch>
git push origin main
```

> Giữ lịch sử fast-forward. Nếu không FF được → rebase branch lên `main` trước.

### Bước 2 — SSH vào server, kéo code mới

```bash
ssh lab46
```

```bash
cd /home/huuduy/ielts-app && git pull --ff-only
```

> `git pull` trên server chỉ cần cho **backend** (Docker build từ `./backend`) và cho `docker-compose.yml`. Frontend `dist/` **không** lấy từ git — nó được đẩy lên ở bước 6. Cứ pull để mọi thứ đồng bộ.

### Bước 3 — Build frontend TẠI LOCAL

Server không có Node. Build ở máy local.

```bash
cd frontend
npm run build
```

> `VITE_API_URL` được nạp **tự động** từ `frontend/.env.production` (file này đã commit trong
> repo, nội dung đúng 1 dòng `VITE_API_URL=https://hzuy.net/api`). Vite chỉ đọc `.env.production`
> khi `vite build`; `npm run dev` vẫn dùng `frontend/.env` (`http://localhost:3001/api`). Vì vậy
> **không** cần set `$env:VITE_API_URL` / prefix inline nữa, và **không** đụng vào `frontend/.env`.
>
> ⚠️ Nếu bạn tự set biến `VITE_API_URL` trong shell/process env thì nó sẽ **đè** `.env.production`
> (process env ưu tiên hơn file). Đừng set trừ khi cố ý build cho domain khác.

### Bước 4 — Verify NGAY trong bundle local (trước khi đẩy lên)

**PowerShell:**

```powershell
Select-String -Path "dist\assets\*.js" -Pattern "https://hzuy\.net/api" | Select-Object -First 3
```

**bash:**

```bash
grep -rl "https://hzuy.net/api" frontend/dist/assets/*.js
```

- ✅ Phải có ít nhất 1 match `https://hzuy.net/api` → chứng tỏ `.env.production` đã được nhúng vào bundle.
- ⚠️ Chuỗi `http://localhost:3001/api` **vẫn sẽ xuất hiện** trong bundle — đó là fallback chết
  `import.meta.env.VITE_API_URL || 'http://localhost:3001/api'` trong `src/utils/axios.js` và
  `src/utils/media.js`. Vì `.env.production` cung cấp `VITE_API_URL`, Vite thay tĩnh thành
  `"https://hzuy.net/api" || "http://localhost:3001/api"` → nhánh phải không bao giờ chạy.
  **Sự hiện diện của `localhost:3001` KHÔNG phải lỗi.**
  **Dấu hiệu lỗi thật là `https://hzuy.net/api` VẮNG MẶT.**

### Bước 5 — Backup `dist` cũ trên server

Trên shell SSH của server:

```bash
cd /home/huuduy/ielts-app/frontend
cp -a dist "dist.backup-$(date +%Y%m%d-%H%M%S)"
```

### Bước 6 — Đẩy `dist` mới lên server

Từ **máy local** (git-bash / WSL / macOS terminal — cần `tar` + `ssh`):

```bash
ssh lab46 'rm -rf /home/huuduy/ielts-app/frontend/dist && mkdir -p /home/huuduy/ielts-app/frontend/dist'
```

```bash
tar -C frontend/dist -czf - . | ssh lab46 'tar -C /home/huuduy/ielts-app/frontend/dist -xzf -'
```

> Xóa sạch rồi giải nén để không tích lũy file asset hash cũ. An toàn vì đã có backup ở bước 5.
> Trên PowerShell thuần không có `tar` pipe tiện — dùng git-bash, hoặc `scp -r frontend/dist/* lab46:/home/huuduy/ielts-app/frontend/dist/` (nhớ xóa dist cũ trước).

### Bước 7 — 🔴 BẮT BUỘC: fix SELinux context cho `dist` mới

Bỏ bước này → **403 Forbidden toàn bộ file tĩnh**. API vẫn chạy (đi qua proxy), nên rất dễ
tưởng nhầm "chỉ frontend lỗi lung tung".

**Tại sao:** web root nằm trong `/home` (nhãn SELinux mặc định `user_home_t`). Nginx chạy dưới
domain `httpd_t`, bị SELinux enforcing chặn đọc file có nhãn đó. Mỗi lần copy file mới vào,
file mang nhãn mới **không tự kế thừa** nhãn `httpd_sys_content_t` — phải gán lại thủ công.

**Cách chính** (cần mật khẩu sudo, cần **TTY tương tác thật** — chạy trong shell SSH đang mở,
KHÔNG chạy được qua `ssh lab46 'sudo ...'` non-interactive):

```bash
sudo restorecon -RvF /home/huuduy/ielts-app/frontend/dist
```

**Cách dự phòng** nếu sudo không có TTY (dùng quyền owner file, không cần sudo):

```bash
chcon -R -u system_u -t httpd_sys_content_t /home/huuduy/ielts-app/frontend/dist
```

Verify nhanh (nhãn phải là `httpd_sys_content_t`):

```bash
ls -Z /home/huuduy/ielts-app/frontend/dist/index.html
```

### Bước 8 — Backend: rebuild container (chỉ khi có đổi `backend/`)

Trên server, ở thư mục có `docker-compose.yml`:

```bash
cd /home/huuduy/ielts-app
```

Ghi lại image cũ TRƯỚC khi build (cho rollback — xem [mục 4](#4-rollback)):

```bash
docker compose images backend
```

Build + restart:

```bash
docker compose build backend && docker compose up -d backend
```

Kiểm tra container lên:

```bash
docker compose ps
docker compose logs --tail=50 backend
```

> `Dockerfile` chạy `npx prisma generate` lúc build (đã có schema trong image). Nó **KHÔNG**
> chạy `migrate deploy` — migration là bước riêng ở dưới.

### Bước 9 — Migration: kiểm tra trước, đừng tự động chạy

**LUÔN** chạy lệnh này trước:

```bash
docker exec ielts-app-backend npx prisma migrate status
```

- **Báo `Database schema is up to date` / 0 pending** → không làm gì thêm. Đây là trường hợp
  thường gặp: local dev dùng **chung DB với prod**, nên migration đã được áp lúc dev
  (lần `86241c6`: 0 pending).
- **Báo có migration pending** → **DỪNG LẠI**. Audit kỹ trước khi chạy:
  - Đối chiếu nội dung từng file trong `backend/prisma/migrations/<...>/migration.sql`.
  - Đặc biệt cảnh giác migration **DESTRUCTIVE** (`DROP TABLE`, `DROP COLUMN`, `ALTER ... TYPE`).
    Vì DB dùng chung, một `DROP` chạy từ đây ảnh hưởng luôn cả môi trường dev.
  - Chỉ khi chắc chắn:

    ```bash
    docker exec ielts-app-backend npx prisma migrate deploy
    ```

### Bước 10 — Smoke test qua domain thật

Không chỉ `localhost` — test qua `https://hzuy.net` để đi hết chuỗi Cloudflare → Nginx → container.

`index.html` trả 200:

```bash
curl -sI https://hzuy.net/ | head -n 1
```

Lấy tên 1 file asset JS đang được tham chiếu:

```bash
curl -s https://hzuy.net/ | grep -o '/assets/[^"]*\.js' | head -n 1
```

File asset đó trả 200 + đúng `Content-Type` (`application/javascript` hoặc `text/javascript`):

```bash
curl -sI https://hzuy.net/assets/<FILE>.js | grep -i '^content-type'
```

Bundle chứa đúng domain API (grep baseURL trong chunk axios):

```bash
curl -s https://hzuy.net/assets/<FILE>.js | grep -o 'https://hzuy.net/api' | head -n 1
```

1 API public trả JSON hợp lệ:

```bash
curl -s https://hzuy.net/api/practice/reading | head -c 200
```

> Nếu tất cả xanh: xong. Mở `https://hzuy.net` trên trình duyệt, đăng nhập thử 1 phát cho chắc.

---

## 4. Rollback

### Backend

Điều kiện: đã lưu image id cũ ở [bước 8](#bước-8--backend-rebuild-container-chỉ-khi-có-đổi-backend) (`docker compose images backend`, hoặc `docker images | grep -i backend`).

```bash
cd /home/huuduy/ielts-app
```

Xem tên:tag image mà compose đang trông đợi:

```bash
docker compose images backend
```

Gán lại image cũ vào đúng tên:tag đó rồi restart:

```bash
docker tag <OLD_IMAGE_ID> <IMAGE_NAME>:<TAG>
docker compose up -d backend
```

> Nếu migration đã chạy ở bước 9 và cần lùi schema → phải viết migration đảo ngược thủ công.
> Prisma không có `migrate down`. Cân nhắc kỹ vì DB dùng chung với dev.

### Frontend

Trên shell SSH của server:

```bash
cd /home/huuduy/ielts-app/frontend
rm -rf dist && mv dist.backup-<TIMESTAMP> dist
```

🔴 **NHỚ chạy lại SELinux fix** — backup cũng không giữ được context đúng sau khi `mv`:

```bash
sudo restorecon -RvF /home/huuduy/ielts-app/frontend/dist
```

---

## 5. Lỗi thường gặp — triage nhanh

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Trang trắng / **403 Forbidden** ở mọi file tĩnh, nhưng `curl https://hzuy.net/api/...` vẫn **200** | SELinux context của `dist` sai (nhãn `user_home_t` thay vì `httpd_sys_content_t`) | [Bước 7](#bước-7--bắt-buộc-fix-selinux-context-cho-dist-mới) |
| Trang **load được** nhưng mọi section gọi API báo *"Lỗi tải dữ liệu / Không thể kết nối máy chủ"*; `curl` API trực tiếp lại OK | `VITE_API_URL` bị build sai — bundle nhúng `http://localhost:3001/api` làm baseURL thật. **Hiếm** từ khi có `frontend/.env.production` (xem mục 6.1); chỉ xảy ra nếu ai đó tự set `$env:VITE_API_URL` sai trong shell (process env đè file), hoặc `.env.production` bị xóa/sửa | Kiểm tra `frontend/.env.production` còn đúng `VITE_API_URL=https://hzuy.net/api` và không có biến `VITE_API_URL` nào set trong shell → build lại [bước 3](#bước-3--build-frontend-tại-local) + verify [bước 4](#bước-4--verify-ngay-trong-bundle-local-trước-khi-đẩy-lên), đẩy lại |
| API báo lỗi **CORS** trên console trình duyệt (`No 'Access-Control-Allow-Origin'`) | `backend/.env` trên server thiếu `FRONTEND_URL=https://hzuy.net` | Thêm biến vào `backend/.env` trên server, `docker compose up -d backend` |
| `prisma migrate status` báo pending bất ngờ | Có migration mới chưa áp lên DB chung | Audit [bước 9](#bước-9--migration-kiểm-tra-trước-đừng-tự-động-chạy) trước khi `migrate deploy` |

### Phân biệt 2 lỗi đầu (dễ nhầm là "cùng 1 vấn đề")

Triệu chứng bên ngoài giống nhau ("trang không hoạt động"), nhưng:

- **403 SELinux** xảy ra ngay ở **tầng Nginx** → `curl -I https://hzuy.net/` (hoặc một file asset) trả **status 403**. Frontend còn không load nổi.
- **VITE_API_URL sai** → Nginx trả **200 bình thường**, frontend **load được**, chỉ có JS bên trong gọi sai địa chỉ. Phải xem **Network tab** của DevTools hoặc `grep` bundle mới thấy.

---

## 6. Việc chưa làm, nên cân nhắc

### 6.1. ĐÃ LÀM — `frontend/.env.production` đã commit, bỏ hẳn trò env override

Đợt cập nhật 2026-09-04: thêm `frontend/.env.production` (nội dung đúng 1 dòng
`VITE_API_URL=https://hzuy.net/api`). `.gitignore` root có rule `**/.env` nhưng rule này
**không** khớp `.env.production` — đã verify bằng `git check-ignore -v frontend/.env.production`
(exit 1, không match) → file commit được.

Vite tự nạp `.env.production` **chỉ khi `vite build`**; `npm run dev` vẫn dùng `.env` (localhost)
— đã verify thực tế qua `loadEnv` của Vite và dev server thật. Nhờ vậy [bước 3](#bước-3--build-frontend-tại-local)
rút gọn còn `npm run build`, không cần set/xóa `$env:` và không còn nguy cơ quên.

Nguồn gốc lỗi #2 ở mục 5 (VITE_API_URL build sai) về cơ bản không còn xảy ra theo quy trình
chuẩn. Dòng đó vẫn **giữ lại trong bảng triage** như thông tin phòng hờ — phòng trường hợp ai đó
lỡ tự set biến môi trường `VITE_API_URL` đè lên `.env.production`, hoặc file bị xóa/sửa.

### 6.2. Chuyển web root sang `/var/www/hzuy` (khỏi restorecon mỗi lần)

`/var/www` có nhãn SELinux mặc định `httpd_sys_content_t` sẵn. Các bước nếu làm:

```bash
sudo mkdir -p /var/www/hzuy
sudo chown huuduy:huuduy /var/www/hzuy
```

- Sửa directive `root` trong Nginx config (`huuduy.conf`) từ `/home/huuduy/ielts-app/frontend/dist` → `/var/www/hzuy`.
- `sudo nginx -t && sudo systemctl reload nginx`.
- Đổi đích deploy ở [bước 5–7](#bước-5--backup-dist-cũ-trên-server) sang `/var/www/hzuy`.
- Chạy `sudo restorecon -RvF /var/www/hzuy` **một lần** — sau đó file copy vào thường kế thừa đúng nhãn.

### 6.3. Dọn Docker image dangling định kỳ

Không gấp, nhưng sau vài lần `docker compose build` sẽ tích image `<none>`:

```bash
docker image prune -f
```
