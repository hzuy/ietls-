# IELTS Practice App

Ứng dụng luyện thi IELTS với bài thi và bài luyện tập cho bốn kỹ năng **Reading, Listening, Writing, Speaking**. Dự án gồm frontend React, backend Express và cơ sở dữ liệu PostgreSQL dùng Prisma.

## Tính năng

### Học viên

- Làm bài thi theo từng kỹ năng và bài thi tổng hợp.
- Luyện tập theo kỹ năng, làm bài mẫu Writing và Speaking.
- Xem kết quả, lịch sử và tiến độ học tập.
- Lưu bản nháp bài làm trên trình duyệt.
- Nhận phản hồi AI cho bài Writing và Speaking.

### Admin và Teacher

- Quản lý đề thi, bộ đề, bài luyện tập và bài mẫu.
- Quản lý người dùng, tài khoản nhân sự, cài đặt và nội dung đã xóa.
- Tải lên hình ảnh, audio và quản lý nội dung câu hỏi.
- Xem báo cáo, lịch sử thao tác và dữ liệu tổng quan.

## Công nghệ

| Khu vực | Công nghệ |
|---|---|
| Frontend | React 19, React Router 7, TanStack Query 5, Tailwind CSS 4, Vite 8 |
| Backend | Node.js, Express 5, Prisma 5, Zod |
| Cơ sở dữ liệu | PostgreSQL |
| Kiểm thử | Vitest, Testing Library, Supertest |
| Tích hợp | Gemini/Groq cho các tính năng AI, Cloudinary cho lưu trữ media (tùy cấu hình) |

## Cấu trúc dự án

```text
ielts-app/
├── backend/
│   ├── lib/             # Tiện ích, cache, phân quyền và tích hợp dùng chung
│   ├── middleware/      # Xác thực, validation và middleware
│   ├── prisma/          # Schema, migrations và seed
│   ├── routes/          # API Express
│   ├── services/        # Tích hợp AI, email và lưu trữ
│   ├── validators/      # Schema kiểm tra request
│   └── server.js        # Điểm khởi chạy backend
├── frontend/
│   ├── src/components/  # Thành phần giao diện
│   ├── src/pages/       # Trang ứng dụng
│   ├── src/services/    # API clients
│   └── vite.config.js
├── docs/                # Tài liệu hệ thống và cơ sở dữ liệu
├── scripts/             # Script dùng chung
├── docker-compose.yml
├── DEPLOY.md
└── README.md
```

## Yêu cầu

- Node.js **20.19 trở lên** hoặc **22.12 trở lên**.
- npm.
- Docker Desktop nếu muốn dùng PostgreSQL dev chạy bằng Docker.

## Cài đặt và chạy local

### 1. Cài dependencies

```bash
git clone <repository-url>
cd ielts-app

cd backend
npm ci

cd ../frontend
npm ci
```

Repo không có `package.json` ở thư mục gốc; chạy lệnh npm trong `backend/` hoặc `frontend/`.

### 2. Khởi động PostgreSQL dev

Từ thư mục gốc dự án:

```bash
docker compose up -d postgres-dev
```

Tạo file `backend/docker-dev.env` (file này được gitignore) với cấu hình khớp service `postgres-dev` mặc định:

```env
DATABASE_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
DIRECT_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
```

Từ `backend/`, tạo schema và dữ liệu mẫu:

```bash
npm run db:dev:push
npm run db:dev:seed
```

Các lệnh `db:dev:*`, `test:dev-db` và lệnh chạy backend ở bước tiếp theo sử dụng `backend/docker-dev.env`, được kiểm tra để trỏ vào `127.0.0.1:5433`.

### 3. Chạy backend

Tại terminal thứ nhất:

```bash
cd backend
node scripts/with-dev-db.js -- npm run dev
```

Backend chạy tại `http://localhost:3001`; API có prefix `/api`.

**Không chạy `npm run dev` trực tiếp nếu `backend/.env` chưa được xác nhận an toàn.** File `.env` có thể trỏ tới cơ sở dữ liệu Supabase dùng chung. Trước khi tiếp tục, kiểm tra log khởi động backend có ghi `local dev (postgres-dev)`. Nếu log báo DB remote, hãy dừng server và kiểm tra cấu hình.

### 4. Chạy frontend

Tại terminal thứ hai:

```bash
cd frontend
npm run dev
```

Mở `http://localhost:5173`. Trong chế độ dev, frontend mặc định gọi `http://localhost:3001/api`. Có thể đặt `VITE_API_URL` trong file env local để đổi API endpoint.

## Biến môi trường

Mẫu cấu hình có tại `backend/.env.example` và `frontend/.env.example`.

### Backend

| Biến | Mục đích |
|---|---|
| `DATABASE_URL` | Kết nối PostgreSQL cho ứng dụng |
| `DIRECT_URL` | Kết nối trực tiếp PostgreSQL cho Prisma |
| `JWT_SECRET` | Ký và xác thực token phiên đăng nhập |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Tích hợp tính năng AI |
| `CLOUDINARY_URL` hoặc bộ `CLOUDINARY_*` | Lưu trữ media trên Cloudinary; có thể dùng cấu hình local tùy môi trường |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Gửi email xác minh tài khoản |
| `FRONTEND_URL` | Thêm origin frontend vào CORS khi chạy ở domain khác |
| `PORT` | Cổng backend; mặc định `3001` |

Không commit file `.env`, connection string, JWT secret, API key, mật khẩu SMTP hoặc dữ liệu người dùng. Không dùng `backend/.env` để chạy thử nếu chưa xác nhận database đích.

### Frontend

| Biến | Mục đích |
|---|---|
| `VITE_API_URL` | URL API, ví dụ `http://localhost:3001/api` khi phát triển local |
| `VITE_GOOGLE_CLIENT_ID` | Client ID cho đăng nhập Google nếu bật tính năng này |

Biến `VITE_*` được nhúng vào bundle khi build. Không đặt secret trong biến frontend. Cấu hình `.env.production` hiện có phục vụ môi trường triển khai; kiểm tra endpoint trước khi tạo bundle cho môi trường khác.

## Lệnh thường dùng

### Backend (`backend/`)

```bash
npm run dev             # Dev server; chỉ chạy sau khi xác nhận DB đích
npm start               # Chạy server
npm run build           # Sinh Prisma Client
npm test                # Vitest; có thể nạp backend/.env
npm run test:dev-db     # Chạy test qua cấu hình postgres-dev an toàn
npm run db:dev:push     # Đồng bộ schema vào postgres-dev
npm run db:dev:seed     # Tạo dữ liệu mẫu trong postgres-dev
npm run db:dev:studio   # Mở Prisma Studio trên postgres-dev
```

Ưu tiên `npm run test:dev-db` cho test tích hợp. Tránh chạy test có thao tác ghi/xóa dữ liệu với `backend/.env` nếu chưa xác nhận database.

### Frontend (`frontend/`)

```bash
npm run dev             # Vite dev server tại cổng 5173
npm run build           # Tạo production bundle
npm run preview         # Xem thử bundle đã build
npm run lint            # ESLint
npm test                # Vitest
```

Chạy một file test cụ thể:

```bash
# Từ backend/
npm test -- routes/adminExams.test.js

# Từ frontend/
npm test -- src/pages/Home.test.jsx
```

## Cơ sở dữ liệu và an toàn dữ liệu

- PostgreSQL dev chạy ở `127.0.0.1:5433`, tách khỏi PostgreSQL mặc định ở cổng `5432`.
- Dữ liệu trong `postgres-dev` là dữ liệu phát triển; seed tạo dữ liệu mẫu.
- Các lệnh `db:dev:*` và `test:dev-db` dừng nếu cấu hình không trỏ đúng `127.0.0.1:5433`.
- Không chạy migration, seed hoặc test có ghi dữ liệu với cấu hình remote khi chưa xác nhận rõ database đích.
- Xem [docs/DATABASE.md](docs/DATABASE.md) để biết thêm về schema.

## Triển khai

Quy trình triển khai production được ghi riêng trong [DEPLOY.md](DEPLOY.md). Hãy đọc runbook đó trước khi thay đổi cấu hình server, database hoặc phát hành phiên bản.

## Tài liệu khác

- [Schema cơ sở dữ liệu](docs/DATABASE.md)
- [Quy trình triển khai](DEPLOY.md)
- [Báo cáo audit admin/teacher](docs/admin-teacher-audit-2026-11-02.md)
