# IELTS Practice App

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748?logo=prisma&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.2-06B6D4?logo=tailwindcss&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

Ứng dụng luyện thi IELTS toàn diện hỗ trợ cả 4 kỹ năng **Reading · Listening · Writing · Speaking**. Người dùng có thể luyện từng kỹ năng riêng lẻ hoặc thi **Full Test** mô phỏng đề Cambridge thực tế. Bài Writing và Speaking được chấm điểm tự động bởi AI (Groq `llama-3.3-70b-versatile`).

---

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Schema Database](#schema-database)
- [Cài đặt & Chạy dự án](#cài-đặt--chạy-dự-án)
- [Biến môi trường](#biến-môi-trường)
- [Các trang & URL chính](#các-trang--url-chính)
- [API Endpoints](#api-endpoints)
- [Tính điểm Band Score](#tính-điểm-band-score)
- [Bảo mật](#bảo-mật)

---

## Tính năng

### Người dùng

- **Xác thực** — Đăng ký / đăng nhập bằng email + mật khẩu, token JWT hết hạn sau 7 ngày
- **Reading** — Đọc passage, trả lời 40 câu hỏi, nhận Band score ngay sau khi nộp bài
- **Listening** — Nghe audio, trả lời câu hỏi, nhận Band score theo thang IELTS chính thức
- **Writing** — Viết Task 1 & Task 2, nhận phản hồi chi tiết và điểm từ AI theo 4 tiêu chí IELTS
- **Speaking** — Nhập transcript cho 3 phần, nhận phản hồi AI về Fluency, Vocabulary, Grammar, Pronunciation
- **Full Test** — Làm đủ 4 kỹ năng của một đề Cambridge, nhận Overall Band Score tổng hợp
- **Theo dõi tiến độ** — Xem trạng thái hoàn thành từng kỹ năng trên tất cả bộ đề

### Admin

- Tạo / sửa / xóa đề thi cho cả 4 kỹ năng
- Upload audio (MP3, WAV, OGG, M4A, AAC — tối đa 100 MB)
- Upload ảnh minh họa & bìa sách (JPG, PNG, GIF, WebP, SVG — tối đa 20 MB)
- Transcribe audio tự động bằng Groq Whisper
- Quản lý bộ đề Cambridge theo Series → Book → Test Number
- Trích xuất nội dung từ file PDF Cambridge
- Phân quyền admin cho người dùng khác

---

## Công nghệ sử dụng

### Backend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Node.js | ≥ 18 | Runtime |
| Express.js | 5.2.1 | Web framework |
| Prisma ORM | 5.22.0 | Tương tác database |
| PostgreSQL | ≥ 14 | Cơ sở dữ liệu |
| jsonwebtoken | 9.0.3 | Xác thực JWT |
| bcryptjs | 3.0.3 | Hash mật khẩu (10 salt rounds) |
| groq-sdk | 1.1.1 | Chấm điểm AI Writing/Speaking + Whisper transcription |
| @anthropic-ai/sdk | 0.80.0 | Anthropic API (dự phòng) |
| multer | 2.1.1 | Upload file |
| pdf-parse | 1.1.1 | Đọc nội dung PDF |
| pdf-lib | 1.17.1 | Xử lý PDF |
| mammoth | 1.12.0 | Đọc file Word (.docx) |
| cors | 2.8.6 | Cross-Origin Resource Sharing |
| dotenv | 17.3.1 | Quản lý biến môi trường |
| nodemon | 3.1.14 | Auto-reload khi phát triển |

### Frontend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| React | 19.2.4 | UI framework |
| Vite | 8.0.1 | Build tool & dev server |
| React Router DOM | 7.13.1 | Client-side routing |
| Tailwind CSS | 4.2.2 | Utility-first CSS |
| Axios | 1.13.6 | HTTP client (với auth interceptor) |
| ESLint | 9.39.4 | Linting |

---

## Cấu trúc thư mục

```
ielts-app/
├── backend/
│   ├── middleware/
│   │   └── auth.js                 # Xác thực JWT cho mọi route protected
│   ├── prisma/
│   │   ├── schema.prisma           # Toàn bộ schema database
│   │   └── migrations/             # Lịch sử Prisma migrations
│   ├── routes/
│   │   ├── auth.js                 # POST /register, POST /login
│   │   ├── reading.js              # GET/POST đề Reading + tính band score
│   │   ├── listening.js            # GET/POST đề Listening + tính band score
│   │   ├── writing.js              # GET/POST đề Writing + chấm điểm Groq AI
│   │   ├── speaking.js             # GET/POST đề Speaking + chấm điểm Groq AI
│   │   ├── fulltest.js             # Trạng thái + kết quả Full Test
│   │   └── admin.js                # CRUD đề, upload file, Cambridge tools
│   ├── uploads/                    # File audio & ảnh đã upload (gitignored)
│   ├── recalculate-scores.js       # Script tiện ích tính lại điểm
│   ├── seed.js                     # Seed dữ liệu mẫu
│   ├── server.js                   # Entry point Express
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── ReadingList.jsx
│   │   │   ├── ReadingExam.jsx
│   │   │   ├── ListeningList.jsx
│   │   │   ├── ListeningExam.jsx
│   │   │   ├── WritingList.jsx
│   │   │   ├── WritingExam.jsx
│   │   │   ├── SpeakingList.jsx
│   │   │   ├── SpeakingExam.jsx
│   │   │   ├── FullTest.jsx
│   │   │   ├── FullTestResult.jsx
│   │   │   └── Admin.jsx
│   │   ├── utils/
│   │   │   └── axios.js            # Axios instance tự động gắn Bearer token
│   │   ├── App.jsx                 # Route definitions + PrivateRoute wrapper
│   │   └── main.jsx
│   ├── vite.config.js              # Vite + React plugin + Tailwind plugin
│   └── package.json
│
├── Cambridge/                      # PDF gốc đề Cambridge (Cam1, Cam17–19)
└── README.md
```

---

## Schema Database

### Sơ đồ quan hệ

```
ExamSeries ──< BookCover
ExamSeries ──< Exam

Exam ──< Passage         ──< QuestionGroup ──< Question
      │                  │                ──< NoteSection ──< NoteLine
      │                  │                ──< MatchingOption
      │                  └──< Question (standalone)
      │
      ├──< ListeningSection ──< QuestionGroup ──< Question
      │                     └──< Question (standalone)
      │
      ├──< WritingTask  ──< WritingAnswer
      ├──< SpeakingPart ──< SpeakingQuestion
      │                 ──< SpeakingAnswer
      └──< Attempt      ──< QuestionAnswer

User ──< Attempt
     ──< WritingAnswer
     ──< SpeakingAnswer
```

### Bảng `User`

| Field | Type | Ghi chú |
|-------|------|---------|
| `id` | Int PK | Auto-increment |
| `email` | String | Unique |
| `password` | String | Bcrypt hash |
| `name` | String | Tên hiển thị |
| `role` | String | `"user"` \| `"admin"` (default: `"user"`) |
| `createdAt` | DateTime | — |

### Bảng `Exam`

| Field | Type | Ghi chú |
|-------|------|---------|
| `id` | Int PK | — |
| `title` | String | Tên đề thi |
| `skill` | String | `reading` \| `listening` \| `writing` \| `speaking` |
| `bookNumber` | Int? | Số cuốn Cambridge (1–19) |
| `testNumber` | Int? | Số đề trong cuốn (1–4) |
| `seriesId` | Int? | FK → `ExamSeries` |
| `coverImageUrl` | String? | URL ảnh bìa |

### Bảng `Question` (Reading + Listening)

| Field | Type | Ghi chú |
|-------|------|---------|
| `number` | Int | Số thứ tự câu hỏi |
| `type` | String | Xem bảng loại câu hỏi bên dưới |
| `questionText` | String | Nội dung câu hỏi |
| `options` | String? | JSON array các lựa chọn |
| `correctAnswer` | String | Đáp án đúng |
| `passageId` | Int? | FK → `Passage` |
| `listeningSectionId` | Int? | FK → `ListeningSection` |
| `groupId` | Int? | FK → `QuestionGroup` |

**Các loại câu hỏi được hỗ trợ:**

| Type | Mô tả |
|------|-------|
| `mcq` | Trắc nghiệm 1 đáp án |
| `mcq_multi` | Trắc nghiệm nhiều đáp án |
| `fill_blank` | Điền vào chỗ trống |
| `short_answer` | Trả lời ngắn |
| `true_false_ng` | True / False / Not Given |
| `yes_no_ng` | Yes / No / Not Given |
| `matching` | Nối đáp án |
| `matching_headings` | Nối tiêu đề đoạn văn |
| `matching_features` | Nối đặc điểm |
| `matching_paragraph` | Nối thông tin với đoạn |
| `matching_endings` | Nối phần cuối câu |
| `choose_title` | Chọn tiêu đề phù hợp |
| `diagram_completion` | Điền vào sơ đồ |
| `map_diagram` | Sơ đồ bản đồ |

### Bảng `WritingAnswer`

| Field | Type | Ghi chú |
|-------|------|---------|
| `essayText` | String | Bài viết |
| `wordCount` | Int | Số từ |
| `aiFeedback` | String? | JSON phản hồi chi tiết từ AI |
| `aiScore` | Float? | Band score AI chấm (0–9, bước 0.5) |

### Bảng `Attempt` (Reading + Listening)

| Field | Type | Ghi chú |
|-------|------|---------|
| `userId` | Int | FK → `User` |
| `examId` | Int | FK → `Exam` |
| `score` | Float? | Band score (0–9) |
| `finishedAt` | DateTime? | Thời điểm hoàn thành |

---

## Cài đặt & Chạy dự án

### Yêu cầu

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm**
- Tài khoản **Groq** — lấy API key miễn phí tại [console.groq.com](https://console.groq.com)

### 1. Clone repository

```bash
git clone <repository-url>
cd ielts-app
```

### 2. Cài đặt dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Tạo database PostgreSQL

```sql
CREATE DATABASE ielts_app;
```

### 4. Cấu hình biến môi trường

```bash
cd backend
```

Tạo file `.env` (xem chi tiết ở mục [Biến môi trường](#biến-môi-trường)):

```bash
cp .env.example .env   # nếu có file mẫu
# hoặc tạo mới và điền các giá trị
```

### 5. Chạy Prisma Migration

```bash
cd backend

# Tạo toàn bộ bảng theo schema
npx prisma migrate deploy

# Sinh Prisma Client
npx prisma generate
```

> **Development:** dùng `npx prisma migrate dev` để vừa migrate vừa theo dõi schema thay đổi.

### 6. (Tuỳ chọn) Seed dữ liệu mẫu

```bash
node seed.js
```

### 7. Chạy Backend

```bash
# Development — tự động reload, bỏ qua thư mục uploads/
npm run dev

# Production
npm start
```

Backend chạy tại: `http://localhost:3001`

### 8. Chạy Frontend

Mở terminal mới:

```bash
cd frontend
npm run dev
```

Frontend chạy tại: `http://localhost:5173`

### 9. Tạo tài khoản Admin

Lần đầu tiên, cập nhật trực tiếp trong database:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'your@email.com';
```

Sau khi đã có admin, dùng API để nâng quyền cho người khác:

```bash
curl -X POST http://localhost:3001/api/admin/make-admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"email": "newadmin@example.com"}'
```

---

## Biến môi trường

Tạo file `backend/.env`:

```env
# Kết nối PostgreSQL (chuẩn Prisma)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ielts_app"

# Khoá bí mật ký JWT — đặt chuỗi ngẫu nhiên đủ dài (≥ 32 ký tự)
JWT_SECRET="your_super_secret_jwt_key_here"

# API key Groq — dùng cho chấm điểm Writing/Speaking và Whisper transcription
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxx"

# Port backend (tuỳ chọn, mặc định 3001)
PORT=3001
```

| Biến | Bắt buộc | Mặc định | Mô tả |
|------|:--------:|----------|-------|
| `DATABASE_URL` | ✅ | — | Connection string PostgreSQL |
| `JWT_SECRET` | ✅ | — | Khoá ký JWT token |
| `GROQ_API_KEY` | ✅ | — | Key từ [console.groq.com](https://console.groq.com) |
| `PORT` | ❌ | `3001` | Port lắng nghe của backend |

---

## Các trang & URL chính

| URL | Trang | Yêu cầu đăng nhập |
|-----|-------|:-----------------:|
| `/login` | Đăng nhập | ❌ |
| `/register` | Đăng ký | ❌ |
| `/` | Dashboard trang chủ | ✅ |
| `/reading` | Danh sách đề Reading | ✅ |
| `/reading/:id` | Làm bài Reading | ✅ |
| `/listening` | Danh sách đề Listening | ✅ |
| `/listening/:id` | Làm bài Listening (có audio player) | ✅ |
| `/writing` | Danh sách đề Writing | ✅ |
| `/writing/:id` | Làm bài Writing + nhận phản hồi AI | ✅ |
| `/speaking` | Danh sách đề Speaking | ✅ |
| `/speaking/:id` | Làm bài Speaking + nhận phản hồi AI | ✅ |
| `/full-test` | Danh sách bộ đề Cambridge + tiến độ | ✅ |
| `/full-test/result` | Overall Band Score (4 kỹ năng) | ✅ |
| `/admin` | Trang quản trị nội dung | ✅ (admin) |

> Mọi route protected đều dùng `PrivateRoute` — nếu không có token trong `localStorage`, tự động redirect về `/login`.

---

## API Endpoints

### Public

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| `POST` | `/api/auth/register` | `{ email, password, name }` | Tạo tài khoản mới |
| `POST` | `/api/auth/login` | `{ email, password }` | Đăng nhập, trả về JWT token |

### Protected — Người dùng

> Header bắt buộc: `Authorization: Bearer <token>`

#### Reading

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/reading/exams` | Danh sách đề kèm số câu hỏi |
| `GET` | `/api/reading/exams/:id` | Chi tiết đề (passages + câu hỏi đầy đủ) |
| `POST` | `/api/reading/exams/:id/submit` | Nộp bài, trả về Band score |

#### Listening

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/listening/exams` | Danh sách đề kèm số câu hỏi |
| `GET` | `/api/listening/exams/:id` | Chi tiết đề (sections + audio URL + câu hỏi) |
| `POST` | `/api/listening/exams/:id/submit` | Nộp bài, trả về Band score |

#### Writing

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/writing/exams` | Danh sách đề |
| `GET` | `/api/writing/exams/:id` | Chi tiết đề (tasks + prompt + ảnh) |
| `POST` | `/api/writing/exams/:id/submit` | Nộp bài viết, trả về phản hồi AI + score |

#### Speaking

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/speaking/exams` | Danh sách đề |
| `GET` | `/api/speaking/exams/:id` | Chi tiết đề (parts + questions + cue card) |
| `POST` | `/api/speaking/exams/:id/submit` | Nộp transcript, trả về phản hồi AI + score |

#### Full Test

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/full-test/status?examId=X` | Kiểm tra đề có thuộc bộ Full Test không |
| `GET` | `/api/full-test/result?seriesId=X&bookNumber=Y&testNumber=Z` | Kết quả Overall Band Score |
| `GET` | `/api/full-test/user-progress` | Tiến độ của user trên tất cả Full Tests |

### Protected — Admin only

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/api/admin/upload-audio` | Upload file audio (`multipart/form-data`) |
| `POST` | `/api/admin/upload-image` | Upload file ảnh (`multipart/form-data`) |
| `POST` | `/api/admin/transcribe` | Transcribe audio bằng Groq Whisper |
| `GET` | `/api/admin/exams` | Tất cả đề thi với metadata |
| `POST` | `/api/admin/exams/reading` | Tạo đề Reading |
| `POST` | `/api/admin/exams/listening` | Tạo đề Listening |
| `POST` | `/api/admin/exams/writing` | Tạo đề Writing |
| `POST` | `/api/admin/exams/speaking` | Tạo đề Speaking |
| `GET` | `/api/admin/exams/:id` | Chi tiết đề (full data) |
| `PUT` | `/api/admin/exams/:id` | Cập nhật đề |
| `DELETE` | `/api/admin/exams/:id` | Xóa đề |
| `POST` | `/api/admin/exams/:id/cover` | Upload ảnh bìa cho đề |
| `GET` | `/api/admin/exam-series` | Danh sách Cambridge series |
| `POST` | `/api/admin/exam-series` | Tạo series mới |
| `POST` | `/api/admin/cambridge/upload` | Upload PDF Cambridge |
| `POST` | `/api/admin/cambridge/extract` | Trích xuất nội dung từ PDF |
| `POST` | `/api/admin/cambridge/extract-save` | Trích xuất và lưu vào DB |
| `POST` | `/api/admin/make-admin` | Nâng quyền admin cho user |

---

## Tính điểm Band Score

### Reading (40 câu)

| Số câu đúng | Band |
|:-----------:|:----:|
| ≥ 39 | 9.0 |
| ≥ 37 | 8.5 |
| ≥ 35 | 8.0 |
| ≥ 33 | 7.5 |
| ≥ 30 | 7.0 |
| ≥ 27 | 6.5 |
| ≥ 23 | 6.0 |
| ≥ 19 | 5.5 |
| ≥ 15 | 5.0 |
| ≥ 13 | 4.5 |
| ≥ 10 | 4.0 |
| ≥ 8 | 3.5 |
| ≥ 6 | 3.0 |
| ≥ 4 | 2.5 |
| < 4 | 0 |

### Listening (40 câu)

| Số câu đúng | Band |
|:-----------:|:----:|
| ≥ 39 | 9.0 |
| ≥ 37 | 8.5 |
| ≥ 35 | 8.0 |
| ≥ 32 | 7.5 |
| ≥ 30 | 7.0 |
| ≥ 26 | 6.5 |
| ≥ 23 | 6.0 |
| ≥ 18 | 5.5 |
| ≥ 16 | 5.0 |
| ≥ 13 | 4.5 |
| ≥ 10 | 4.0 |
| ≥ 8 | 3.5 |
| ≥ 6 | 3.0 |
| ≥ 4 | 2.5 |
| < 4 | 0 |

### Writing & Speaking

Được chấm bởi Groq `llama-3.3-70b-versatile`. Kết quả trả về JSON gồm điểm từng tiêu chí và nhận xét, sau đó làm tròn về bước 0.5 (ví dụ: 6.3 → 6.5).

### Overall Band (Full Test)

```
overall = trung_bình(reading, listening, writing, speaking)
- Phần thập phân ≥ 0.75 → làm tròn lên nguyên
- Phần thập phân ≥ 0.25 → làm tròn thành .5
- Phần thập phân < 0.25 → bỏ phần thập phân
```

---

## Bảo mật

### Đã triển khai

- Mật khẩu hash bằng **bcryptjs** với 10 salt rounds
- **JWT** có thời hạn 7 ngày, verify bằng `JWT_SECRET` trên mỗi request
- **Phân quyền admin** kiểm tra `req.user.role === 'admin'` trước mọi route admin
- **Giới hạn file upload**: chỉ chấp nhận đúng định dạng và dung lượng tối đa
- **CORS** chỉ cho phép origin `http://localhost:5173`
- JSON body giới hạn 10 MB (`express.json({ limit: '10mb' })`)

### Cần làm trước khi deploy Production

- [ ] Thay `JWT_SECRET` bằng chuỗi ngẫu nhiên ≥ 32 ký tự, lưu an toàn
- [ ] Cập nhật CORS `origin` trong `server.js` thành domain thực tế
- [ ] Chuyển lưu file upload lên cloud storage (AWS S3, Cloudinary...) thay vì thư mục local
- [ ] Bật HTTPS cho cả backend lẫn frontend
- [ ] Thêm rate limiting để chống brute-force login
- [ ] Đảm bảo `.env` không bị commit lên git
- [ ] Đặt `NODE_ENV=production`
