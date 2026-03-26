# Hướng dẫn Deploy IELTS App

## Tổng quan
- **Database**: Supabase (PostgreSQL miễn phí)
- **Backend**: Render (Node.js miễn phí)
- **Frontend**: Vercel (React/Vite miễn phí)

---

## Bước 1: Tạo Database trên Supabase

1. Truy cập https://supabase.com → **Start your project**
2. Đăng nhập bằng GitHub
3. Nhấn **New project**, điền:
   - Name: `ielts-app`
   - Database Password: đặt mật khẩu mạnh (lưu lại!)
   - Region: **Southeast Asia (Singapore)**
4. Chờ project tạo xong (~2 phút)
5. Vào **Project Settings** → **Database** → **Connection string** → chọn tab **URI**
6. Copy chuỗi `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
7. Thay `[YOUR-PASSWORD]` bằng mật khẩu vừa đặt → đây là `DATABASE_URL`

---

## Bước 2: Deploy Backend lên Render

1. Truy cập https://render.com → **Get Started** → đăng nhập bằng GitHub
2. Nhấn **New** → **Web Service**
3. Chọn **Connect a repository** → chọn repo GitHub của bạn
4. Cấu hình:
   - **Name**: `ielts-app-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build && npx prisma migrate deploy`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Kéo xuống phần **Environment Variables**, thêm lần lượt:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Chuỗi URI từ Supabase ở bước 1 |
   | `JWT_SECRET` | Một chuỗi random bất kỳ, vd: `myieltsapp2024secretkey` |
   | `GROQ_API_KEY` | API key từ https://console.groq.com |
   | `FRONTEND_URL` | Để trống trước, điền sau |
   | `NODE_ENV` | `production` |
6. Nhấn **Create Web Service** → đợi deploy (~5 phút)
7. Sau khi xong, copy URL backend (dạng `https://ielts-app-backend.onrender.com`)

---

## Bước 3: Deploy Frontend lên Vercel

1. Truy cập https://vercel.com → **Sign Up** → đăng nhập bằng GitHub
2. Nhấn **Add New** → **Project** → chọn repo GitHub
3. Cấu hình:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (tự detect)
4. Mở **Environment Variables**, thêm:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://ielts-app-backend.onrender.com/api` |
5. Nhấn **Deploy** → đợi ~2 phút
6. Sau khi xong, copy URL frontend (dạng `https://ielts-app.vercel.app`)

---

## Bước 4: Cập nhật FRONTEND_URL trên Render

1. Vào Render → chọn service `ielts-app-backend`
2. Vào **Environment** → tìm `FRONTEND_URL`
3. Điền URL Vercel vừa lấy ở bước 3, vd: `https://ielts-app.vercel.app`
4. Nhấn **Save Changes** → Render sẽ tự redeploy

---

## Bước 5: Seed dữ liệu (nếu cần)

Sau khi backend đã chạy, mở terminal và chạy:

```bash
# Vào thư mục backend
cd backend

# Tạo file .env từ mẫu và điền DATABASE_URL từ Supabase
cp .env.example .env

# Chạy seed
node seed.js
```

---

## Lưu ý quan trọng

- **Render free tier** sẽ ngủ sau 15 phút không có request → lần đầu vào sẽ chờ ~30-50s
- **Supabase free tier** sẽ pause sau 1 tuần không active → vào dashboard Supabase nhấn **Restore** là xong
- **File upload (audio)**: Trên Render, file upload vào `uploads/` sẽ mất khi redeploy. Nếu cần lưu lâu dài, cần dùng Cloudinary hoặc AWS S3.
- **Sau khi deploy**, đăng ký tài khoản đầu tiên rồi dùng `make-admin.js` để tạo admin

---

## Troubleshooting

**Backend báo lỗi "Can't reach database"**
→ Kiểm tra lại `DATABASE_URL` trong Render, đảm bảo đã thay đúng password

**Frontend không gọi được API**
→ Kiểm tra `VITE_API_URL` trong Vercel, phải đúng URL Render (không có dấu `/` ở cuối `/api`)

**CORS error**
→ Kiểm tra `FRONTEND_URL` trong Render, phải khớp đúng URL Vercel
