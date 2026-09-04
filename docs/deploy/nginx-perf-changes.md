# P4 — Cache-Control cho static asset (Nginx)

> Chuẩn bị sẵn để copy-paste khi SSH vào `lab46`. **Chưa áp dụng.**
> Config Nginx thật (`huuduy.conf`) chỉ nằm trên server, không có trong repo —
> mọi số/đường dẫn dưới đây là mẫu, tự đối chiếu với file thật.

---

## 1. Bối cảnh (đo ngày 2026-09-04)

`curl -I` vào asset production cho thấy:

```
GET https://hzuy.net/assets/index-<hash>.js
  Cache-Control: max-age=14400          ← chỉ 4 giờ, THIẾU "immutable"
  cf-cache-status: REVALIDATED

GET https://hzuy.net/assets/index-<hash>.css
  Cache-Control: max-age=14400
  cf-cache-status: MISS

GET https://hzuy.net/uploads/<file>.jpg
  Cache-Control: public, max-age=14400
```

- File trong `/assets/` do Vite build ra, **tên có hash nội dung** (`index-CvLkPdso.js`,
  `AreaChart-CqrcLLTr.js`…). Nội dung đổi ⇒ tên đổi ⇒ **không bao giờ cần revalidate**.
  Vẫn để `max-age=14400` nghĩa là khách quay lại sau 4h phải hỏi lại server từng file
  (dù nội dung y hệt). Nên đặt `max-age=1 năm` + `immutable`.
- `14400` giống nhau ở cả `.js`, `.css`, ảnh ⇒ nhiều khả năng đang có **1 rule chung**
  (`expires 4h;` hoặc `location ~* \.(js|css|png|...)$`) trong `huuduy.conf`. Cần tìm
  rule đó và thay bằng 2 rule riêng bên dưới, đừng thêm chồng lên.
- `index.html` **không có hash tên** ⇒ tuyệt đối KHÔNG cache dài. Xem mục 3.

---

## 2. Đoạn config cần thêm/sửa trong `huuduy.conf`

### 2.1. Trước tiên — tìm rule cache đang tồn tại

```bash
sudo grep -nE 'expires|Cache-Control|max-age|14400|location .*\\.(js|css)' <ĐƯỜNG-DẪN>/huuduy.conf
# <ĐƯỜNG-DẪN> thường là /etc/nginx/conf.d/  hoặc  /etc/nginx/sites-available/
```

Nếu thấy 1 rule chung áp `expires 4h` cho mọi file tĩnh → **xoá/sửa** nó, rồi thêm 2 block dưới.

### 2.2. `/assets/` — bundle có hash, cache 1 năm + immutable

Đặt **trong `server { ... }` của hzuy.net**, cùng cấp với `location /`:

```nginx
    # Bundle Vite: tên file có hash nội dung → an toàn cache vĩnh viễn.
    # '^~' để prefix này THẮNG mọi 'location ~* \.(js|css)$' regex có thể còn sót.
    location ^~ /assets/ {
        # 'root' kế thừa từ server block (thư mục chứa frontend/dist).
        # Nếu server block KHÔNG có 'root', thêm dòng:  root /home/huuduy/ielts-app/frontend;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        access_log off;
        try_files $uri =404;
    }
```

### 2.3. `/uploads/` — ảnh (proxy vào container), cache 30 ngày

`/uploads/` hiện **proxy_pass vào `127.0.0.1:5001`** (không phải file tĩnh). Sửa
đúng block `location /uploads/` đang có, thêm 2 dòng header:

```nginx
    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # --- THÊM: ghi đè Cache-Control mà Express phát ra (đang là max-age=14400) ---
        proxy_hide_header Cache-Control;
        add_header Cache-Control "public, max-age=2592000" always;   # 30 ngày
    }
```

> `2592000` = 30 ngày. Ảnh bìa/thumbnail đổi rất hiếm; nếu admin thay ảnh thì
> **tên file mới** (timestamp) nên client không dính bản cũ.

### 2.4. `index.html` — KHÔNG cache dài (xem mục 3)

```nginx
    location = /index.html {
        # HTML là điểm vào, phải luôn lấy bản mới nhất để nhận hash bundle mới.
        add_header Cache-Control "no-cache" always;   # cho phép lưu nhưng phải revalidate
    }

    location / {
        try_files $uri /index.html;
        # (giữ nguyên phần còn lại của block này)
    }
```

### ⚠️ Bẫy `add_header` của Nginx

Khi 1 `location` có **bất kỳ** `add_header` nào, nó **KHÔNG kế thừa** `add_header` từ
`server {}` cha (vd `X-Frame-Options`, `Strict-Transport-Security`…). Nếu `huuduy.conf`
có các security header ở cấp `server`, phải **lặp lại** chúng trong `location /assets/`
và `location = /index.html`. Kiểm tra:

```bash
sudo grep -n 'add_header' <ĐƯỜNG-DẪN>/huuduy.conf
```

---

## 3. Ghi chú riêng cho HTML — vì sao không `immutable`

| | `/assets/index-<hash>.js` | `/index.html` |
|---|---|---|
| Tên file | có hash nội dung | cố định |
| Nội dung mới sau deploy | tên file MỚI | cùng tên, nội dung khác |
| Nếu cache 1 năm | vô hại (URL cũ không ai gọi nữa) | **client kẹt bản cũ 1 năm**, trỏ tới bundle hash đã bị xoá → trắng trang |

⇒ `index.html`: `no-cache` (hoặc `max-age=0, must-revalidate`) ở Nginx.

**Tuỳ chọn thêm ở Cloudflare** (không bắt buộc): hiện `index.html` có
`cf-cache-status: DYNAMIC` (Cloudflare không cache). Có thể tạo 1 Cache Rule cho
`hzuy.net/` với `Edge TTL = 60s` + `Browser TTL = respect origin` để giảm 1 chặng
origin cho lượt truy cập lặp, kèm 1 bước **purge cache** trong quy trình deploy
(`DEPLOY.md`). Rủi ro: trong ≤60s sau deploy, khách có thể nhận HTML cũ → thường
chấp nhận được. Nếu ngại, bỏ qua phần Cloudflare, chỉ làm phần Nginx.

---

## 4. Ảnh `.webp` mới vs ảnh cũ trong `/uploads/`

Sau script batch P3c (`backend/scripts/resize-existing-covers.js`), `/uploads/` chứa
lẫn lộn:
- ảnh `.webp` mới (route upload tự resize),
- ảnh cũ đã resize tại chỗ / đổi `.jpg`→`.webp`,
- ảnh gốc backup nằm ở `/uploads/_originals/` (client không gọi tới).

**Tất cả đều dưới prefix `/uploads/` và path không đổi** ⇒ rule `location /uploads/`
ở mục 2.3 áp dụng như nhau, **không cần** tách rule theo định dạng.

---

## 5. Bước áp dụng

```bash
# 1. Backup config
sudo cp <ĐƯỜNG-DẪN>/huuduy.conf <ĐƯỜNG-DẪN>/huuduy.conf.bak.$(date +%F)

# 2. Sửa file (nano/vim), theo mục 2

# 3. Test cú pháp — KHÔNG reload nếu bước này fail
sudo nginx -t

# 4. Nạp lại config (không downtime, không restart toàn bộ)
sudo systemctl reload nginx
#   hoặc:  sudo nginx -s reload
```

Rollback nếu hỏng: `sudo cp <...>/huuduy.conf.bak.<ngày> <...>/huuduy.conf && sudo nginx -t && sudo systemctl reload nginx`

---

## 6. Verify sau khi áp dụng

```bash
# Asset có hash → phải thấy: max-age=31536000, immutable
JS=$(curl -s https://hzuy.net/ | grep -o '/assets/[^"]*\.js' | head -1)
curl -sI "https://hzuy.net$JS" | grep -i cache-control
# kỳ vọng:  cache-control: public, immutable   (và Expires ~1 năm sau)

# Ảnh upload → phải thấy: max-age=2592000
IMG=$(curl -s https://hzuy.net/api/admin/full-tests | grep -oE '/uploads/[^"]+\.(webp|jpg|png)' | head -1)
curl -sI "https://hzuy.net$IMG" | grep -i cache-control
# kỳ vọng:  cache-control: public, max-age=2592000

# index.html → KHÔNG được có max-age dài
curl -sI https://hzuy.net/ | grep -i cache-control
# kỳ vọng:  cache-control: no-cache   (hoặc không có dòng nào is fine hơn max-age lớn)

# security header (nếu server block có) vẫn còn trên /assets/
curl -sI "https://hzuy.net$JS" | grep -iE 'x-frame-options|strict-transport|x-content-type'
```

Ngoài ra mở DevTools → Network → reload lần 2: file `/assets/*` phải là
`(disk cache)` / `200 (from memory cache)`, không phải `304`.

---

## 7. Sau khi xong

Ghi lại vào đây: **đã áp dụng ngày ______, huuduy.conf backup tại ______.**
