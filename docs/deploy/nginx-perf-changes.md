# P4 — Cache-Control cho static asset (Nginx + Cloudflare)

> Cập nhật 2026-09-04 sau khi SSH đọc config thật trên `lab46`.
> **Phần Nginx cần `sudo` → người dùng tự chạy. Phần Cloudflare làm trên dashboard.**

---

## 1. Hiện trạng THẬT (đã verify trên server)

Kiến trúc: `Browser → Cloudflare (edge + tunnel) → nginx :8080 → (dist tĩnh | proxy :5001)`
Config: `/etc/nginx/conf.d/huuduy.conf` (root-owned), main `/etc/nginx/nginx.conf`.

| Nguồn | Header cho `/assets/*.js` |
|---|---|
| **Origin nginx** (`curl :8080` trực tiếp) | **KHÔNG có `Cache-Control`** — chỉ `ETag`. `huuduy.conf` không có `expires`/`add_header` nào. |
| **Express** cho `/uploads/*` | `Cache-Control: public, max-age=0` (mặc định `express.static`) |
| **Cloudflare edge** (`curl https://hzuy.net`) | `Cache-Control: max-age=14400` + `cf-cache-status: HIT` |

⇒ **`max-age=14400` là do Cloudflare tự thêm** (setting *Browser Cache TTL* mặc định = 4h),
KHÔNG phải nginx. Vậy P4 có **2 phần độc lập**:

- **4A — Nginx**: cho origin phát `Cache-Control` đúng (immutable cho `/assets/`, 30d cho `/uploads/`, no-cache cho `index.html`).
- **4B — Cloudflare**: đổi *Browser Cache TTL* → **Respect Existing Headers** để Cloudflare ngừng đè `14400` và tôn trọng header của origin.

> Làm 4A mà không làm 4B: Cloudflare vẫn ép `max-age=14400` xuống browser cho các path
> nó cache → cải thiện ít. Làm cả 2 mới có hiệu lực đầy đủ.

Tham chiếu: 2 site khác trên cùng máy (`velstrong-books.conf`, `sachnha.conf`) đã dùng
đúng pattern: `location ^~ /media/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`.

---

## 2. Phần 4A — sửa `/etc/nginx/conf.d/huuduy.conf`

### 2.1. Nội dung HIỆN TẠI (để đối chiếu)

```nginx
server {
    listen 8080;
    server_name _;

    root /home/huuduy/ielts-app/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100m;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100m;
    }
}
```

### 2.2. Nội dung SAU KHI SỬA (copy-paste toàn bộ, ghi đè file)

```nginx
server {
    listen 8080;
    server_name _;

    root /home/huuduy/ielts-app/frontend/dist;
    index index.html;

    # P4A: bundle Vite có hash tên → cache vĩnh viễn. '^~' để thắng mọi regex.
    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
        try_files $uri =404;
    }

    # P4A: index.html KHÔNG có hash tên → luôn phải revalidate để nhận bundle mới.
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100m;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100m;

        # P4A: ảnh bìa/thumbnail đổi rất hiếm (đổi ảnh = tên file mới). Ghi đè
        # 'max-age=0' mà Express phát ra.
        proxy_hide_header Cache-Control;
        add_header Cache-Control "public, max-age=2592000";   # 30 ngày
    }
}
```

**Chỉ thêm 3 block** (`location ^~ /assets/`, `location = /index.html`, và 2 dòng
trong `location /uploads/`). Mọi thứ khác giữ nguyên.

> Ghi chú bẫy `add_header`: `huuduy.conf` không có `add_header` nào ở cấp `server`,
> và không có security header (CF tunnel lo TLS/HSTS). Nên thêm `add_header` trong
> `location` KHÔNG làm mất gì. (Nếu sau này thêm security header ở `server {}` thì
> phải lặp lại trong `location ^~ /assets/` và `location = /index.html`.)

### 2.3. Áp dụng

```bash
# backup
sudo cp /etc/nginx/conf.d/huuduy.conf ~/huuduy.conf.bak.$(date +%F-%H%M)

# sửa (paste nội dung mục 2.2)
sudo nano /etc/nginx/conf.d/huuduy.conf

# test — PHẢI "syntax is ok" + "test is successful" mới sang bước reload
sudo nginx -t

# nạp lại (không downtime)
sudo systemctl reload nginx
```

**Nếu `nginx -t` FAIL** → KHÔNG reload, restore ngay:
```bash
sudo cp ~/huuduy.conf.bak.<ngày-giờ> /etc/nginx/conf.d/huuduy.conf && sudo nginx -t
```

---

## 3. Phần 4B — Cloudflare dashboard

1. Cloudflare → chọn zone `hzuy.net` → **Caching** → **Configuration**.
2. **Browser Cache TTL** → đổi từ `4 hours` (hoặc giá trị hiện tại) → **`Respect Existing Headers`**.
3. (Tuỳ chọn) **Caching → Cache Rules** → thêm rule cho `hzuy.net/assets/*`:
   *Eligible for cache* + *Edge TTL: 1 year* + *Browser TTL: Respect origin*.
4. Sau khi đổi: **Caching → Configuration → Purge Everything** (1 lần) để xoá bản
   `max-age=14400` đang nằm ở edge.

> Rủi ro 4B: "Respect Existing Headers" áp cho cả zone. Các path KHÔNG có
> `Cache-Control` từ origin (vd một số response HTML/API) sẽ về `no-cache` mặc định
> của CF thay vì 4h — thường tốt hơn (tươi hơn), không hại. Nếu lo, dùng Cache Rules
> per-path ở bước 3 thay vì đổi setting toàn zone.

---

## 4. Vì sao `index.html` KHÔNG `immutable`

| | `/assets/index-<hash>.js` | `/index.html` |
|---|---|---|
| Tên file | có hash nội dung | cố định |
| Sau deploy mới | file tên MỚI | cùng tên, nội dung khác |
| Nếu cache 1 năm | vô hại (URL cũ không ai gọi) | **client kẹt bản cũ**, trỏ tới bundle hash đã bị xoá → **trắng trang** |

---

## 5. Ảnh trong `/uploads/`

Sau script batch P3c (đã chạy 2026-09-04): `/uploads/` chứa ảnh `.webp` mới (bìa
`146-198KB` → `~7KB`), 3 thumbnail resize tại chỗ, và bản gốc ở
`/home/huuduy/ielts-app/backend/uploads/_originals/` (6.8M — client không gọi tới,
xoá tay sau khi yên tâm). **Tất cả dưới `/uploads/` → 1 rule `location /uploads/` là đủ.**

---

## 6. Verify sau khi áp dụng (4A + 4B)

```bash
# 6.1. Origin phát header đúng chưa (chạy TRÊN server, bỏ qua Cloudflare)
F=$(ls /home/huuduy/ielts-app/frontend/dist/assets/index-*.js | head -1 | xargs basename)
curl -sI "http://127.0.0.1:8080/assets/$F" -H "Host: hzuy.net" | grep -i cache-control
#   kỳ vọng:  Cache-Control: public, max-age=31536000, immutable

curl -sI "http://127.0.0.1:8080/" -H "Host: hzuy.net" | grep -i cache-control
#   kỳ vọng:  Cache-Control: no-cache

U=$(curl -s http://127.0.0.1:5001/api/admin/full-tests | grep -oE '/uploads/[^"]+\.webp' | head -1)
curl -sI "http://127.0.0.1:8080$U" -H "Host: hzuy.net" | grep -i cache-control
#   kỳ vọng:  Cache-Control: public, max-age=2592000   (KHÔNG còn max-age=0)
```

```bash
# 6.2. Qua Cloudflare — sau khi đổi 4B + Purge (chạy từ máy bất kỳ)
JS=$(curl -s https://hzuy.net/ | grep -oE '/assets/index-[^"]+\.js' | head -1)
curl -sI "https://hzuy.net$JS" | grep -iE 'cache-control|cf-cache-status'
#   kỳ vọng:  cache-control: public, max-age=31536000, immutable   (KHÔNG còn 14400)

curl -sI "https://hzuy.net/uploads/$(basename $U)" | grep -i cache-control
#   kỳ vọng:  max-age=2592000
```

DevTools → Network → reload lần 2: file `/assets/*` phải là `(disk cache)` /
`(memory cache)`, không phải `200` tải lại hay `304`.

---

## 7. Trạng thái

- [x] P4A soạn sẵn — **CHƯA áp dụng** (cần `sudo`, người dùng tự chạy mục 2.3)
- [ ] P4B Cloudflare — người dùng tự làm trên dashboard (mục 3)
- Áp dụng ngày: __________   ·   backup config: __________
