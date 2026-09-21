# IELTS Practice App

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.2-06B6D4?logo=tailwindcss&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8.0.1-646CFF?logo=vite&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)

Nền tảng luyện thi IELTS toàn diện với kiến trúc hiện đại, cung cấp khả năng ôn luyện đầy đủ 4 kỹ năng: **Reading · Listening · Writing · Speaking**. Dự án được xây dựng tập trung vào trải nghiệm học thuật, kết hợp cùng các công nghệ AI (Groq Llama 3.3) để chấm điểm và phân tích tự động, mang đến giải pháp luyện thi tối ưu.

---

## 📑 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Tính năng nổi bật (Key Features)](#tính-năng-nổi-bật-key-features)
3. [Công nghệ sử dụng (Tech Stack)](#công-nghệ-sử-dụng-tech-stack)
4. [Cấu trúc thư mục (Project Structure)](#cấu-trúc-thư-mục-project-structure)
5. [Hướng dẫn cài đặt & Setup (Installation)](#hướng-dẫn-cài-đặt--setup-installation)
6. [Biến môi trường (Environment Variables)](#biến-môi-trường-environment-variables)
7. [Các lệnh phổ biến (Available Scripts)](#các-lệnh-phổ-biến-available-scripts)
8. [Tài liệu tham khảo & Triển khai](#tài-liệu-tham-khảo--triển-khai)

---

## Tổng quan

Dự án cung cấp một hệ thống học tập hoàn chỉnh cho phép thi các bài kiểm tra rèn luyện từng kỹ năng hoặc làm bài **Full Test** chuẩn format Cambridge. Với đợt nâng cấp giao diện UI/UX tối giản học thuật mới, bổ sung lưu trạng thái nháp LocalStorage, Contextual History và Chatbot tư vấn, dự án nhắm đến tính ổn định cao nhất cho người học.

---

## Tính năng nổi bật (Key Features)

### 🎓 Dành cho Người dùng (Học viên)
- **Thi & Luyện đề 4 Kỹ năng:** Hỗ trợ bài thi tổng hợp Full Test lẫn chế độ Practice (Đề lẻ, bài mẫu).
- **AI Scoring & Feedback:** Tự động chấm điểm Writing/Speaking qua API Groq (model `llama-3.3-70b-versatile`). Nhận diện và đánh giá chi tiết theo 4 tiêu chí chuẩn IELTS.
- **Split-screen Contextual History:** Giao diện chia đôi màn hình tiện lợi khi đọc Passage dài kết hợp hiển thị giải thích đáp án.
- **Phân tích tiến độ (Streak/Analytics):** Theo dõi chuỗi ngày học tập (Streak) và biểu đồ hiệu suất thông minh.
- **LocalStorage Draft:** Tự động lưu nháp bài làm (Draft) với thời gian tồn tại 7 ngày, tránh mất dữ liệu khi gián đoạn.
- **AI Chatbot Advisor:** Chatbot tư vấn học tập thông minh (Giới hạn 20 msg/giờ/user, có chống prompt-injection).

### ⚙️ Dành cho Quản trị viên (Admin)
- **CMS Quản lý đề thi:** CRUD đề, câu hỏi bằng bộ editor thông minh, tích hợp auto-renumber token-based.
- **Audio & Image Storage:** Upload media (tối đa 100MB cho audio, 20MB cho ảnh) - hỗ trợ Cloudinary với cơ chế fallback lưu trữ local an toàn.
- **Tự động dịch Audio (Transcription):** Trích xuất văn bản từ file âm thanh qua Groq Whisper.
- **Quản lý rác (Trash & Retention):** Cơ chế Soft-delete, tự động dọn dẹp các mục bị xóa quá 30 ngày (Fire-and-forget qua yêu cầu duyệt).

---

## Công nghệ sử dụng (Tech Stack)

### Backend
- **Framework & Runtime:** Node.js (≥18) + Express 5.2.1
- **Database & ORM:** PostgreSQL (Supabase) + Prisma 5.22.0
- **Validation:** Zod v4 (middleware `req.validatedQuery`)
- **AI Integration:** `groq-sdk` (Chấm điểm AI, Chatbot, Whisper)
- **Utilities:** `jsonwebtoken`, `bcryptjs`, `multer`, `sharp`

### Frontend
- **UI Framework:** React 19.2.4 + Vite 8.0.1
- **Routing & State:** React Router DOM 7.13.1 + TanStack Query v5
- **Styling:** Tailwind CSS 4.2.2 (Kiến trúc CSS-first, cấu hình biến màu linh hoạt cho giao diện đơn sắc)
- **Testing:** Vitest + Testing Library + JSdom

---

## Cấu trúc thư mục (Project Structure)

```text
ielts-app/
├── backend/
│   ├── lib/              # Các hàm tiện ích cốt lõi (roles, groqClient, scoreUtils, swrCache...)
│   ├── middleware/       # Middleware bảo mật, xác thực auth, rateLimit
│   ├── prisma/           # Prisma schema, migrations, seed scripts
│   ├── routes/           # Định nghĩa endpoint Express (admin, reading, writing, chatbot...)
│   ├── services/         # Logic tích hợp bên ngoài (storageService)
│   ├── validators/       # Zod schemas để parse và kiểm tra payload
│   └── server.js         # Entry point chính của hệ thống backend
│
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components dùng chung và các sub-editor
│   │   ├── context/      # Context quản lý State (AuthContext, FormDirtyContext...)
│   │   ├── hooks/        # React hooks tùy chỉnh (useCountUp,...)
│   │   ├── pages/        # Các trang màn hình (Home, FullTest, Admin, Exam...)
│   │   ├── services/     # Axios API Clients gọi tới backend
│   │   ├── utils/        # Các hàm tiện ích frontend (axios interceptor)
│   │   ├── App.jsx       # Component gốc, định tuyến Router (Layout & Guard)
│   │   └── index.css     # Định nghĩa Tailwind theme & global CSS vars
│   └── vite.config.js    # Cấu hình Vite build tool
│
├── docs/                 # Tài liệu hệ thống chi tiết (DATABASE.md)
├── scripts/              # Chứa các file kịch bản chung (kill-dev-ports.js)
└── README.md
```

---

## Hướng dẫn cài đặt & Setup (Installation)

### 1. Yêu cầu hệ thống
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (hoặc cài đặt sẵn Docker để dùng môi trường DB test độc lập)
- **npm** (trình quản lý gói cài đặt)
- Tài khoản **Groq API**

### 2. Cài đặt Dependencies

Clone dự án về máy:
```bash
git clone <repository-url>
cd ielts-app
```

Cài đặt gói thư viện ở cả backend và frontend:
```bash
# Cài đặt backend
cd backend
npm install

# Cài đặt frontend
cd ../frontend
npm install
```

### 3. Khởi tạo Database (Môi trường Dev Local - Khuyên dùng)

Dự án cung cấp một DB Postgres cô lập (`postgres-dev`) chạy qua Docker giúp bạn code và test an toàn mà không chạm vào CSDL production (Supabase).

Tạo file `backend/docker-dev.env` với nội dung (sử dụng credentials có sẵn trong file compose):
```env
DATABASE_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
DIRECT_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
```

Khởi động DB qua Docker và đồng bộ Schema:
```bash
# Mở Docker compose dựng DB dev
docker compose up -d postgres-dev

cd backend

# Đẩy schema Prisma vào DB dev
npm run db:dev:push

# Nạp dữ liệu giả (Admin, User, Exam mẫu)
npm run db:dev:seed
```

### 4. Khởi chạy ứng dụng

Mở 2 cửa sổ terminal chạy đồng thời:

**Terminal 1 (Backend kết nối DB dev):**
```bash
cd backend
node scripts/with-dev-db.js -- npm run dev
# Server lắng nghe tại cổng 3001
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
# Giao diện phục vụ tại cổng 5173
```

---

## Biến môi trường (Environment Variables)

### Backend (`backend/.env`)

**Tuyệt đối không đẩy file này lên repository.** Lưu ý: Bạn cần tạo riêng biến môi trường này cho chế độ production / local không dùng Docker. Nếu dùng `db:dev:*`, app sẽ nạp từ file `backend/docker-dev.env`.

| Biến | Loại | Ý nghĩa |
| :--- | :---: | :--- |
| `DATABASE_URL` | Bắt buộc | Connection string Postgres (Supabase). Ví dụ: `postgresql://USER:PASS@HOST:5432/DB` |
| `DIRECT_URL` | Bắt buộc | Connection trực tiếp cho Prisma Migrate |
| `JWT_SECRET` | Bắt buộc | Chuỗi siêu bí mật ký JWT |
| `GROQ_API_KEY` | Bắt buộc | Key API chấm điểm AI. VD: `gsk_your_api_key_here` |
| `FRONTEND_URL` | Tùy chọn | Bắt buộc ở Prod để cấu hình CORS (Ví dụ: `https://yourdomain.com`) |
| `CLOUDINARY_URL` | Tùy chọn | Key lưu trữ ảnh trên mây (Bỏ trống app tự lưu local) |
| `PORT` | Tùy chọn | Mặc định `3001` |

### Frontend (`frontend/.env` / `.env.production`)

Các biến này được nội suy lúc biên dịch (build-time):

| Biến | Loại | Ý nghĩa |
| :--- | :---: | :--- |
| `VITE_API_URL` | Bắt buộc | URL Backend API. VD: `http://localhost:3001/api` |
| `VITE_GOOGLE_CLIENT_ID`| Tùy chọn | Client ID đăng nhập bằng Google |

---

## Các lệnh phổ biến (Available Scripts)

### Backend (`/backend`)
```bash
npm run dev              # Chạy dev server qua nodemon (Mặc định dùng .env)
npm run build            # Tạo lại Prisma client (npx prisma generate)
npm run kill-ports       # Giải phóng port 3001 và 5173 nếu bị treo
npm run test:dev-db      # Chạy toàn bộ test suite (Vitest) trên DB dev
npm run db:dev:studio    # Mở Prisma Studio để xem dữ liệu của DB dev
npm run db:dev:seed -- --cleanup  # Dọn dẹp toàn bộ dữ liệu mẫu đã seed
```

### Frontend (`/frontend`)
```bash
npm run dev              # Chạy server Vite tại cổng 5173
npm run build            # Biên dịch mã React (Production bundle)
npm run lint             # Chạy bộ check lỗi mã bằng Eslint 9
npm run test             # Chạy bài test giao diện bằng Vitest
```

---

## Tài liệu tham khảo & Triển khai

1. 📂 **[Chi tiết Database Schema](./docs/DATABASE.md):** Xem kỹ cấu trúc các bảng dữ liệu (User, Exam, Question...).
2. 🚀 **[Hướng dẫn triển khai (Deployment)](./DEPLOY.md):** Đọc file quy trình deploy manual lên môi trường Production (`lab46` - Nginx + Docker).
