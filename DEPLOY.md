# DEPLOY.md — Quy trình deploy production

> Runbook thao tác thủ công để deploy app IELTS lên server self-hosted (lab46). Dùng làm
> checklist thực thi trực tiếp cho mỗi lần deploy — đọc theo thứ tự, chạy đúng lệnh, không
> cần suy luận lại từ đầu.
>
> Không có secret / password / connection string thật trong file này. Chỗ nào cần
> nhắc tới thì dùng placeholder (`<DATABASE_URL>`, `<OLD_IMAGE_ID>`, `<FILE>`...).

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Điều kiện tiên quyết và checklist biến môi trường](#2-điều-kiện-tiên-quyết-và-checklist-biến-môi-trường)
3. [Quy trình deploy từng bước](#3-quy-trình-deploy-từng-bước)
4. [Rollback](#4-rollback)
5. [Lỗi thường gặp — triage nhanh](#5-lỗi-thường-gặp--triage-nhanh)
6. [Bảo trì định kỳ](#6-bảo-trì-định-kỳ)

---

## 1. Kiến trúc tổng quan

| Thành phần | Chi tiết |
|---|---|
| **Server** | `lab46` — self-hosted, IP `10.100.200.126`, user `huuduy`. |
| **Domain** | `https://hzuy.net`, đứng sau **Cloudflare proxy**. Cloudflare che IP origin → **KHÔNG SSH được qua `hzuy.net`**, phải SSH thẳng vào `lab46` / `10.100.200.126`. |
| **Backend** | Docker container `ielts-app-backend` (`docker-compose.yml` ở root repo, `/home/huuduy/ielts-app`). Bind `127.0.0.1:5001` (không mở ra Internet). Nginx trên cùng máy reverse-proxy `/api` và `/uploads` vào container. `PORT=5001`, `NODE_ENV=production`, biến môi trường nạp từ `./backend/.env` trên server. |
| **Frontend** | Static build. Nginx serve trực tiếp từ `/var/www/hzuy`. Không chạy qua Node. |
| **Database** | Supabase PostgreSQL managed, project ref `qtuzysaqftzmveyvrzxz`. **Local dev VÀ prod trỏ CHUNG một database này** — không có DB riêng cho local. Migration chạy từ máy local lúc dev thường đã áp lên đúng cái DB mà prod dùng. Xem [bước 3.10](#bước-310--migration-kiểm-tra-trước-đừng-tự-động-chạy). |
| **CI/CD** | Không có. GitHub Actions chỉ chạy test trên push/PR to `main`, **không tự deploy**. Mọi bước dưới đây là thủ công. |

### Đường đi request

```
Browser ──HTTPS──> Cloudflare ──> Nginx (lab46) ──┬── /            -> /var/www/hzuy (static)
                                                  ├── /api/...     -> 127.0.0.1:5001 (container, giữ nguyên prefix /api)
                                                  └── /uploads/...  -> 127.0.0.1:5001
```

> Config Nginx thật (`huuduy.conf` / trong `/etc/nginx/conf.d/`) **chỉ nằm trên server**, không
> có trong repo. Nếu cần sửa `root` hay `proxy_pass` thì sửa trực tiếp trên server rồi
> `sudo nginx -t && sudo systemctl reload nginx`.
>
> Nếu có lúc cần đổi vị trí web root: luôn copy nội dung sang thư mục đích mới **xong xuôi và
> verify tại chỗ** (`ls` thấy đủ file) rồi mới trỏ `root` Nginx vào đó và reload. Đổi ngược thứ
> tự (trỏ `root` vào thư mục đích trước, copy nội dung sau) sẽ gây 403/404 tạm thời cho site.

---

## 2. Điều kiện tiên quyết và checklist biến môi trường

Cần có sẵn trước khi deploy (thiết lập một lần trên máy điều khiển deploy — làm lại nếu đổi máy):

- **SSH key** `ed25519` tại `~/.ssh/id_ed25519`, đã `ssh-copy-id` lên server.
- **Alias `lab46`** trong `~/.ssh/config`:

  ```sshconfig
  Host lab46
      HostName 10.100.200.126
      User huuduy
      IdentityFile ~/.ssh/id_ed25519
  ```

- User `huuduy` phải ở trong group `docker` trên server → chạy `docker` / `docker compose` không cần `sudo`.
- Node.js **chỉ có ở máy local** — server không cài Node → **frontend luôn build ở local** ([bước 3.4](#bước-34--build-frontend-tại-local)).

**Checklist biến môi trường** (thiếu cái nào thì tính năng liên quan âm thầm hỏng, không lỗi rõ ràng):

`backend/.env` (trên server):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase, dùng chung local/prod — xem [mục 1](#1-kiến-trúc-tổng-quan). |
| `JWT_SECRET` | ✅ | Random 32+ ký tự. |
| `GROQ_API_KEY` | ✅ | Chấm Writing/Speaking + chatbot + transcription. |
| `FRONTEND_URL` | ✅ | `https://hzuy.net` — thiếu → CORS chặn hết request từ domain thật (`server.js` chỉ thêm origin này vào allowlist khi biến tồn tại). |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth login (`routes/auth.js`) — verify `audience` khi decode token Google. Thiếu → endpoint Google login lỗi runtime (lazy init, không throw lúc khởi động nên dễ bỏ sót). |
| `PORT` | tùy chọn | `docker-compose.yml` set `PORT=5001` sẵn. |

`frontend/.env.production` (đã commit trong repo, dùng lúc build ở local — [bước 3.4](#bước-34--build-frontend-tại-local)):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `VITE_API_URL` | ✅ | `https://hzuy.net/api`. Vite chỉ đọc `.env.production` khi `vite build`; `npm run dev` vẫn dùng `frontend/.env` (`http://localhost:3001/api`). |
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Google OAuth login (`src/main.jsx`) — **build-time**, nhúng thẳng vào bundle JS. Thiếu lúc build → phải build lại từ đầu, không sửa được sau khi đã build như biến backend. |

---

## 3. Quy trình deploy từng bước

Checklist thực thi được, theo đúng thứ tự. Nếu **chỉ đổi frontend** thì bỏ qua bước 3.9–3.10. Nếu
**chỉ đổi backend** thì bỏ qua bước 3.4–3.8.

### Bước 3.1 — Chạy full test suite trước khi merge

```bash
cd backend && npm run test
```

```bash
cd frontend && npm run test
```

Cả hai phải xanh. Không deploy nếu có test đỏ.

### Bước 3.2 — Merge branch → `main` và push

```bash
git checkout main
git pull --ff-only
git merge --ff-only <feature-branch>
git push origin main
```

> Giữ lịch sử fast-forward. Nếu không FF được → rebase branch lên `main` trước.

### Bước 3.3 — SSH vào server, kéo code mới

```bash
ssh lab46
```

```bash
cd /home/huuduy/ielts-app && git pull --ff-only
```

> `git pull` trên server chỉ cần cho **backend** (Docker build từ `./backend`) và cho `docker-compose.yml`. Frontend `dist/` **không** lấy từ git — nó được đẩy lên ở bước 3.7. Cứ pull để mọi thứ đồng bộ.

### Bước 3.4 — Build frontend TẠI LOCAL

Server không có Node. Build ở máy local.

```bash
cd frontend
npm run build
```

> `VITE_API_URL` được nạp **tự động** từ `frontend/.env.production` (file này đã commit trong
> repo, nội dung đúng 1 dòng `VITE_API_URL=https://hzuy.net/api`). Vite chỉ đọc `.env.production`
> khi `vite build`; `npm run dev` vẫn dùng `frontend/.env` (`http://localhost:3001/api`). Vì vậy
> **không** cần set `$env:VITE_API_URL` / prefix inline, và **không** đụng vào `frontend/.env`.
>
> ⚠️ Nếu tự set biến `VITE_API_URL` trong shell/process env thì nó sẽ **đè** `.env.production`
> (process env ưu tiên hơn file). Đừng set trừ khi cố ý build cho domain khác.

### Bước 3.5 — Verify NGAY trong bundle local (trước khi đẩy lên)

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

### Bước 3.6 — Backup web root cũ trên server

Trên shell SSH của server:

```bash
cd /var/www
cp -a hzuy "hzuy.backup-$(date +%Y%m%d-%H%M%S)"
```

### Bước 3.7 — Đẩy build mới lên server

Từ **máy local** (git-bash / WSL / macOS terminal — cần `tar` + `ssh`):

```bash
ssh lab46 'rm -rf /var/www/hzuy && mkdir -p /var/www/hzuy'
```

```bash
tar -C frontend/dist -czf - . | ssh lab46 'tar -C /var/www/hzuy -xzf -'
```

> Xóa sạch rồi giải nén để không tích lũy file asset hash cũ. An toàn vì đã có backup ở bước 3.6.
> Trên PowerShell thuần không có `tar` pipe tiện — dùng git-bash, hoặc
> `scp -r frontend/dist/* lab46:/var/www/hzuy/` (nhớ xóa nội dung cũ trước).

### Bước 3.8 — Verify quyền sở hữu web root

`/var/www` có nhãn SELinux mặc định `httpd_sys_content_t` sẵn cho mọi thư mục con, và file mới
copy vào thường **tự kế thừa** nhãn đúng. Chỉ cần đảm bảo owner đúng (không cần sudo):

```bash
ls -la /var/www/hzuy/index.html
```

Owner phải là `huuduy:huuduy`. Nếu nhãn SELinux sai (hiếm), gán lại — cần **TTY tương tác thật**
(chạy trong shell SSH đang mở, KHÔNG chạy được qua `ssh lab46 'sudo ...'` non-interactive):

```bash
sudo restorecon -RvF /var/www/hzuy
```

**Cách dự phòng** nếu sudo không có TTY (dùng quyền owner file, không cần sudo):

```bash
chcon -R -u system_u -t httpd_sys_content_t /var/www/hzuy
```

Verify nhanh (nhãn phải là `httpd_sys_content_t`):

```bash
ls -Z /var/www/hzuy/index.html
```

### Bước 3.9 — Backend: rebuild container (chỉ khi có đổi `backend/`)

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

### Bước 3.10 — Migration: kiểm tra trước, đừng tự động chạy

**LUÔN** chạy lệnh này trước:

```bash
docker exec ielts-app-backend npx prisma migrate status
```

- **Báo `Database schema is up to date` / 0 pending** → không làm gì thêm. Đây là trường hợp
  thường gặp: local dev dùng **chung DB với prod**, nên migration đã được áp lúc dev.
- **Báo có migration pending** → **DỪNG LẠI**. Audit kỹ trước khi chạy:
  - Đối chiếu nội dung từng file trong `backend/prisma/migrations/<...>/migration.sql`.
  - Đặc biệt cảnh giác migration **DESTRUCTIVE** (`DROP TABLE`, `DROP COLUMN`, `ALTER ... TYPE`).
    Vì DB dùng chung, một `DROP` chạy từ đây ảnh hưởng luôn cả môi trường dev.
  - Chỉ khi chắc chắn:

    ```bash
    docker exec ielts-app-backend npx prisma migrate deploy
    ```

### Bước 3.11 — Smoke test qua domain thật

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

Điều kiện: đã lưu image id cũ ở [bước 3.9](#bước-39--backend-rebuild-container-chỉ-khi-có-đổi-backend) (`docker compose images backend`, hoặc `docker images | grep -i backend`).

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

> Nếu migration đã chạy ở bước 3.10 và cần lùi schema → phải viết migration đảo ngược thủ công.
> Prisma không có `migrate down`. Cân nhắc kỹ vì DB dùng chung với dev.

### Frontend

Trên shell SSH của server:

```bash
cd /var/www
rm -rf hzuy && mv hzuy.backup-<TIMESTAMP> hzuy
```

Kiểm tra lại nhãn SELinux sau khi `mv` (xem [mục 5](#5-lỗi-thường-gặp--triage-nhanh)):

```bash
ls -Z /var/www/hzuy/index.html
```

Nếu nhãn sai → chạy lại (cần TTY tương tác thật, không qua `ssh lab46 'sudo ...'`):

```bash
sudo restorecon -RvF /var/www/hzuy
```

---

## 5. Lỗi thường gặp — triage nhanh

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Trang trắng / **403 Forbidden** hoặc **404** ở mọi file tĩnh, nhưng `curl https://hzuy.net/api/...` vẫn **200** | (a) SELinux context của web root sai (nhãn khác `httpd_sys_content_t`); hoặc (b) `root` Nginx trỏ vào thư mục rỗng/thiếu nội dung | (a) `sudo restorecon -RvF /var/www/hzuy` (hoặc `chcon` nếu không có TTY sudo), verify bằng `ls -Z /var/www/hzuy/index.html` phải ra `httpd_sys_content_t`. (b) Đảm bảo đã copy xong nội dung vào `/var/www/hzuy` **trước khi** đổi `root`/reload Nginx |
| Trang **load được** nhưng mọi section gọi API báo *"Lỗi tải dữ liệu / Không thể kết nối máy chủ"*; `curl` API trực tiếp lại OK | `VITE_API_URL` bị build sai — bundle nhúng `http://localhost:3001/api` làm baseURL thật. Xảy ra nếu tự set `$env:VITE_API_URL` trong shell (process env đè file), hoặc `frontend/.env.production` bị xóa/sửa | Kiểm tra `frontend/.env.production` còn đúng `VITE_API_URL=https://hzuy.net/api` và không có biến `VITE_API_URL` nào set trong shell → build lại [bước 3.4](#bước-34--build-frontend-tại-local) + verify [bước 3.5](#bước-35--verify-ngay-trong-bundle-local-trước-khi-đẩy-lên), đẩy lại |
| Google login lỗi (backend 500 hoặc frontend không hiện nút/redirect sai) | Thiếu `GOOGLE_CLIENT_ID` (`backend/.env` trên server) hoặc `VITE_GOOGLE_CLIENT_ID` (`frontend/.env.production` lúc build) — xem checklist ở [mục 2](#2-điều-kiện-tiên-quyết-và-checklist-biến-môi-trường) | Backend: thêm biến + `docker compose up -d backend`. Frontend: biến là build-time → phải sửa `.env.production` rồi build lại từ [bước 3.4](#bước-34--build-frontend-tại-local), không sửa được sau khi đã build |
| API báo lỗi **CORS** trên console trình duyệt (`No 'Access-Control-Allow-Origin'`) | `backend/.env` trên server thiếu `FRONTEND_URL=https://hzuy.net` | Thêm biến vào `backend/.env` trên server, `docker compose up -d backend` |
| `prisma migrate status` báo pending bất ngờ | Có migration mới chưa áp lên DB chung | Audit [bước 3.10](#bước-310--migration-kiểm-tra-trước-đừng-tự-động-chạy) trước khi `migrate deploy` |

### Phân biệt 2 lỗi đầu (dễ nhầm là "cùng 1 vấn đề")

Triệu chứng bên ngoài giống nhau ("trang không hoạt động"), nhưng:

- **403/404 web root** (SELinux hoặc thiếu nội dung) xảy ra ngay ở **tầng Nginx** → `curl -I https://hzuy.net/` (hoặc một file asset) trả **status 403/404**. Frontend còn không load nổi.
- **VITE_API_URL sai** → Nginx trả **200 bình thường**, frontend **load được**, chỉ có JS bên trong gọi sai địa chỉ. Phải xem **Network tab** của DevTools hoặc `grep` bundle mới thấy.

---

## 6. Bảo trì định kỳ

### Dọn Docker image dangling cũ

Sau vài lần `docker compose build` sẽ tích image `<none>` (dangling) trên server. Cron job trên
`lab46` (user `huuduy`) dọn định kỳ, xem bằng `crontab -l`:

```cron
0 3 * * 0 /usr/bin/docker image prune -f >> /home/huuduy/docker-prune.log 2>&1 && tail -n 500 /home/huuduy/docker-prune.log > /home/huuduy/docker-prune.log.tmp && mv /home/huuduy/docker-prune.log.tmp /home/huuduy/docker-prune.log
```

- Chạy Chủ nhật 3h sáng hàng tuần (giờ ít traffic).
- Dùng full path `/usr/bin/docker` (kiểm tra bằng `which docker`) vì `PATH` của cron tối giản
  hơn shell tương tác — `docker` trần có thể không tìm thấy binary.
- Log ghi ra `~/docker-prune.log`; tự rotate giữ 500 dòng cuối sau mỗi lần chạy để không phình
  vô hạn qua nhiều năm.
- Không cần sudo — user `huuduy` đã ở group `docker` ([mục 2](#2-điều-kiện-tiên-quyết-và-checklist-biến-môi-trường)).

Nếu crontab bị mất (đổi server, tái tạo user...), thêm lại bằng:

```bash
(crontab -l 2>/dev/null; echo "0 3 * * 0 /usr/bin/docker image prune -f >> /home/huuduy/docker-prune.log 2>&1 && tail -n 500 /home/huuduy/docker-prune.log > /home/huuduy/docker-prune.log.tmp && mv /home/huuduy/docker-prune.log.tmp /home/huuduy/docker-prune.log") | crontab -
```
