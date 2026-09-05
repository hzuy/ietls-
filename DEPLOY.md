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
| **Frontend** | Static build. Nginx serve trực tiếp từ `/var/www/hzuy`. Không chạy qua Node. |
| **Database** | Supabase PostgreSQL managed, project ref `qtuzysaqftzmveyvrzxz`. **Local dev VÀ prod trỏ CHUNG một database này** — không có DB riêng cho local. Migration chạy từ máy local lúc dev thường đã áp lên đúng cái DB mà prod dùng. Xem [bước 9](#bước-9--migration-kiểm-tra-trước-đừng-tự-động-chạy). |
| **CI/CD** | Không có. GitHub Actions chỉ chạy test trên push/PR to `main`, **không tự deploy**. Mọi bước dưới đây là thủ công. |

### Đường đi request

```
Browser ──HTTPS──> Cloudflare ──> Nginx (lab46) ──┬── /            -> /var/www/hzuy (static)
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

**Checklist biến môi trường** (thiếu cái nào thì tính năng liên quan âm thầm hỏng, không lỗi rõ ràng):

`backend/.env` (trên server):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase, dùng chung local/prod — xem [mục 1](#1-kiến-trúc-tổng-quan). |
| `JWT_SECRET` | ✅ | Random 32+ ký tự. |
| `GROQ_API_KEY` | ✅ | Chấm Writing/Speaking + chatbot + transcription. |
| `FRONTEND_URL` | ✅ | `https://hzuy.net` — thiếu → CORS chặn hết request từ domain thật. |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth login (`routes/auth.js`) — verify `audience` khi decode token Google. Thiếu → endpoint Google login lỗi runtime (lazy init, không throw lúc khởi động nên dễ bỏ sót). |
| `PORT` | tùy chọn | `docker-compose.yml` set `PORT=5001` sẵn. |

`frontend/.env.production` (đã commit trong repo, dùng lúc build ở local — [bước 3](#bước-3--build-frontend-tại-local)):

| Biến | Bắt buộc? | Ghi chú |
|---|---|---|
| `VITE_API_URL` | ✅ | `https://hzuy.net/api` — xem [mục 6.1](#61-đã-làm--frontendenvproduction-đã-commit-bỏ-hẳn-trò-env-override). |
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Google OAuth login (`src/main.jsx`) — **build-time**, nhúng thẳng vào bundle JS. Thiếu lúc build → phải build lại từ đầu, không sửa được sau khi đã build như biến backend. |

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

### Bước 5 — Backup web root cũ trên server

Trên shell SSH của server:

```bash
cd /var/www
cp -a hzuy "hzuy.backup-$(date +%Y%m%d-%H%M%S)"
```

### Bước 6 — Đẩy build mới lên server

Từ **máy local** (git-bash / WSL / macOS terminal — cần `tar` + `ssh`):

```bash
ssh lab46 'rm -rf /var/www/hzuy && mkdir -p /var/www/hzuy'
```

```bash
tar -C frontend/dist -czf - . | ssh lab46 'tar -C /var/www/hzuy -xzf -'
```

> Xóa sạch rồi giải nén để không tích lũy file asset hash cũ. An toàn vì đã có backup ở bước 5.
> Trên PowerShell thuần không có `tar` pipe tiện — dùng git-bash, hoặc `scp -r frontend/dist/* lab46:/var/www/hzuy/` (nhớ xóa nội dung cũ trước).
>
> ⚠️ **Thứ tự thao tác:** LUÔN copy nội dung mới vào `/var/www/hzuy` xong xuôi rồi mới reload Nginx
> (không áp dụng ở đây vì `root` đã trỏ sẵn vào `/var/www/hzuy` từ [mục 6.2](#62-đã-làm--dời-web-root-sang-varwwwhzuy),
> không cần đổi Nginx mỗi lần deploy nữa) — chỉ nhắc lại vì lần dời web root ban đầu **đã bị ngược
> thứ tự** (đổi `root` trỏ vào thư mục rỗng trước, copy nội dung sau), gây 403/404 tạm thời. Xem
> ghi chú sự cố ở [mục 6.2](#62-đã-làm--dời-web-root-sang-varwwwhzuy).

### Bước 7 — Verify quyền sở hữu (không còn cần restorecon mỗi lần)

`/var/www` có nhãn SELinux mặc định `httpd_sys_content_t` sẵn cho mọi thư mục con, và file mới
copy vào thường **tự kế thừa** nhãn đúng — khác với `/home` trước đây. Chỉ cần đảm bảo owner
đúng (không cần sudo):

```bash
ls -la /var/www/hzuy/index.html
```

Owner phải là `huuduy:huuduy`. Nếu nhãn SELinux lại sai (hiếm, xem [mục 5](#5-lỗi-thường-gặp--triage-nhanh)
để chẩn đoán), mới cần chạy lại `restorecon` — không phải bước thường quy nữa.

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
cd /var/www
rm -rf hzuy && mv hzuy.backup-<TIMESTAMP> hzuy
```

Kiểm tra lại nhãn SELinux sau khi `mv` (thường vẫn đúng vì cùng nằm trong `/var/www`, nhưng verify
cho chắc — xem [mục 5](#5-lỗi-thường-gặp--triage-nhanh)):

```bash
ls -Z /var/www/hzuy/index.html
```

Nếu nhãn sai (hiếm) → chạy lại (cần TTY tương tác thật, không qua `ssh lab46 'sudo ...'`):

```bash
sudo restorecon -RvF /var/www/hzuy
```

---

## 5. Lỗi thường gặp — triage nhanh

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Trang trắng / **403 Forbidden** hoặc **404** ở mọi file tĩnh, nhưng `curl https://hzuy.net/api/...` vẫn **200** | (a) SELinux context của web root sai (nhãn khác `httpd_sys_content_t` — hiếm từ khi dùng `/var/www/hzuy`, xem [mục 6.2](#62-đã-làm--dời-web-root-sang-varwwwhzuy)); hoặc (b) `root` Nginx trỏ vào thư mục rỗng/chưa copy nội dung xong (xem sự cố ở mục 6.2) | (a) `sudo restorecon -RvF /var/www/hzuy`, verify bằng `ls -Z /var/www/hzuy/index.html` phải ra `httpd_sys_content_t`. (b) Đảm bảo đã copy xong nội dung vào `/var/www/hzuy` **trước khi** reload Nginx hoặc đổi `root` |
| Trang **load được** nhưng mọi section gọi API báo *"Lỗi tải dữ liệu / Không thể kết nối máy chủ"*; `curl` API trực tiếp lại OK | `VITE_API_URL` bị build sai — bundle nhúng `http://localhost:3001/api` làm baseURL thật. **Hiếm** từ khi có `frontend/.env.production` (xem mục 6.1); chỉ xảy ra nếu ai đó tự set `$env:VITE_API_URL` sai trong shell (process env đè file), hoặc `.env.production` bị xóa/sửa | Kiểm tra `frontend/.env.production` còn đúng `VITE_API_URL=https://hzuy.net/api` và không có biến `VITE_API_URL` nào set trong shell → build lại [bước 3](#bước-3--build-frontend-tại-local) + verify [bước 4](#bước-4--verify-ngay-trong-bundle-local-trước-khi-đẩy-lên), đẩy lại |
| Google login lỗi (backend 500 hoặc frontend không hiện nút/redirect sai) | Thiếu `GOOGLE_CLIENT_ID` (`backend/.env` trên server) hoặc `VITE_GOOGLE_CLIENT_ID` (`frontend/.env.production` lúc build) — xem checklist ở [mục 2](#2-điều-kiện-tiên-quyết-làm-1-lần) | Backend: thêm biến + `docker compose up -d backend`. Frontend: biến là build-time → phải sửa `.env.production` rồi build lại từ [bước 3](#bước-3--build-frontend-tại-local), không sửa được sau khi đã build |
| API báo lỗi **CORS** trên console trình duyệt (`No 'Access-Control-Allow-Origin'`) | `backend/.env` trên server thiếu `FRONTEND_URL=https://hzuy.net` | Thêm biến vào `backend/.env` trên server, `docker compose up -d backend` |
| `prisma migrate status` báo pending bất ngờ | Có migration mới chưa áp lên DB chung | Audit [bước 9](#bước-9--migration-kiểm-tra-trước-đừng-tự-động-chạy) trước khi `migrate deploy` |

### Phân biệt 2 lỗi đầu (dễ nhầm là "cùng 1 vấn đề")

Triệu chứng bên ngoài giống nhau ("trang không hoạt động"), nhưng:

- **403/404 web root** (SELinux hoặc thiếu nội dung) xảy ra ngay ở **tầng Nginx** → `curl -I https://hzuy.net/` (hoặc một file asset) trả **status 403/404**. Frontend còn không load nổi.
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

### 6.2. ĐÃ LÀM — Dời web root sang `/var/www/hzuy`

Thực hiện 2026-09-05. Web root chuyển từ `/home/huuduy/ielts-app/frontend/dist` sang
`/var/www/hzuy` (nhãn SELinux mặc định `httpd_sys_content_t` sẵn, file copy vào tự kế thừa
đúng nhãn — không còn phải `restorecon` mỗi lần deploy như [bước 7](#bước-7--verify-quyền-sở-hữu-không-còn-cần-restorecon-mỗi-lần) cũ).

Các việc đã làm:
- `sudo mkdir -p /var/www/hzuy && sudo chown huuduy:huuduy /var/www/hzuy`.
- Copy toàn bộ nội dung `dist` cũ sang `/var/www/hzuy` (`cp -a`).
- Sửa directive `root` trong `/etc/nginx/conf.d/huuduy.conf` từ `/home/huuduy/ielts-app/frontend/dist` → `/var/www/hzuy`; `sudo nginx -t && sudo systemctl reload nginx`.
- Chạy `sudo restorecon -RvF /var/www/hzuy` một lần.
- Verify qua domain thật: `index.html` 200, asset JS 200 đúng `Content-Type`, bundle chứa đúng
  `https://hzuy.net/api`, API public trả JSON hợp lệ, `diff -rq` giữa `dist` cũ và `/var/www/hzuy`
  khớp 100%.
- Đích deploy ở [bước 5–7](#bước-5--backup-web-root-cũ-trên-server) đã đổi sang `/var/www/hzuy`.

⚠️ **Sự cố phát sinh lúc làm (đã khắc phục ngay):** đổi directive `root` trỏ sang `/var/www/hzuy`
và reload Nginx **trước khi** copy nội dung `dist` sang thư mục đó → site trả 403/404 tạm thời
(web root trỏ đúng chỗ nhưng thư mục rỗng). Khắc phục bằng cách copy bổ sung ngay lập tức, xong
verify lại đầy đủ. **Bài học cho lần dời web root sau này (nếu có):** luôn copy nội dung vào
thư mục đích mới **xong xuôi và verify tại chỗ** (`ls` thấy đủ file) rồi mới đổi `root` Nginx +
reload — không làm ngược thứ tự. Không phải rủi ro thường trực (việc dời web root này coi như
đã xong, không lặp lại ở quy trình deploy thường quy), chỉ ghi chú phòng khi cần dời lần nữa.

`/home/huuduy/ielts-app/frontend/dist` (bản cũ) **chưa xóa** — giữ lại vài ngày để rollback nếu
cần, không còn dùng trong quy trình deploy chính. Có thể xóa sau khi ổn định.

### 6.3. ĐÃ LÀM — Dọn Docker image dangling định kỳ

Thực hiện 2026-09-05. Cron job trên `lab46` (user `huuduy`, `crontab -l` để xem):

```cron
0 3 * * 0 /usr/bin/docker image prune -f >> /home/huuduy/docker-prune.log 2>&1 && tail -n 500 /home/huuduy/docker-prune.log > /home/huuduy/docker-prune.log.tmp && mv /home/huuduy/docker-prune.log.tmp /home/huuduy/docker-prune.log
```

Chạy Chủ nhật 3h sáng hàng tuần (giờ ít traffic). Dùng full path `/usr/bin/docker` vì `PATH` của
cron tối giản hơn shell tương tác. Log ghi ra `~/docker-prune.log`, tự rotate giữ 500 dòng cuối
sau mỗi lần chạy để không phình vô hạn qua nhiều năm. Không cần sudo — user `huuduy` đã ở group
`docker`.
