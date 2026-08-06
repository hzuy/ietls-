# PROJECT AUDIT REPORT

> Báo cáo kiểm toán tổng quan kiến trúc, danh sách module, API, Database và đánh giá rủi ro hệ thống **IELTS Prep Web Application**.

---

## 1. TỔNG QUAN KIẾN TRÚC

### Stack công nghệ thực tế
* **Frontend**:
  * **Framework & UI**: React 19, Vite 8, React Router DOM 7, TailwindCSS 4, Axios.
  * **Export & UI Helpers**: ExcelJS / XLSX, React Datepicker.
  * **Testing**: Vitest 4, React Testing Library, JSDOM, `@testing-library/jest-dom`, `@testing-library/user-event`.
* **Backend**:
  * **Runtime & Web Framework**: Node.js (CommonJS), Express 5, Compression (gzip).
  * **Database & ORM**: PostgreSQL (hosted on Supabase Cloud), Prisma ORM 5.22.
  * **Authentication & Validation**: JWT (`jsonwebtoken`), `bcryptjs`, Zod.
  * **Tích hợp AI & File Processing**: Groq AI SDK (`groq-sdk`), Multer (file upload), `pdf-parse`, ExcelJS streaming.
  * **Testing**: Vitest 4, Supertest.
* **Tích hợp dịch vụ bên ngoài (`.env`)**:
  * `DATABASE_URL` / `DIRECT_URL`: PostgreSQL Instance kết nối qua Supabase Transaction/Session Pooler.
  * `GROQ_API_KEY`: Groq Cloud API (Phân tích bóc tách file PDF đề thi Cambridge & chấm bài viết/nói bằng AI).
  * `JWT_SECRET`: Khóa mã hóa JWT Token.

---

### Cấu trúc thư mục chính

```
ielts-app/
├── backend/
│   ├── lib/              # Prisma client, helper phân quyền, scoreUtils (tính điểm IELTS)
│   ├── middleware/       # Middleware xác thực JWT (auth.js) & validate dữ liệu Zod (validate.js)
│   ├── prisma/           # Schema Prisma (schema.prisma) & migration history
│   ├── routes/           # REST API Endpoints
│   │   ├── admin/        # Sub-routes quản trị (dashboard, users, exams, cambridge, trash, uploads...)
│   │   ├── admin.js      # Aggregator router cho /api/admin
│   │   ├── auth.js       # Register, Login, Change Password
│   │   ├── reading.js    # Thi & nộp bài Reading
│   │   ├── listening.js  # Thi & nộp bài Listening
│   │   ├── writing.js    # Thi & nộp bài Writing + AI Grading
│   │   ├── speaking.js   # Thi & nộp bài Speaking + AI Grading
│   │   ├── fulltest.js   # Làm bài thi thử Full Test theo bộ đề
│   │   ├── practice.js   # Bài luyện tập ngắn (Practice)
│   │   ├── samples.js    # Bài mẫu Writing / Speaking Sample
│   │   ├── series.js     # Danh sách bộ đề (Cambridge, Practice Plus)
│   │   └── user.js       # Lấy thông tin cá nhân & lịch sử thi học viên
│   ├── scripts/          # Script vận hành & backfill dữ liệu database
│   ├── services/         # Dịch vụ AI (cambridge/aiQuestionParser.js, pdfExtractor.js, examBuilder.js)
│   ├── validators/       # Zod Schemas (auth, admin, submission, content)
│   └── server.js         # Entry point backend server Express
├── frontend/
│   ├── src/
│   │   ├── components/   # UI components (Navbar, Footer, ErrorBoundary, Question Editors/Renderers)
│   │   ├── context/      # AuthContext (quản lý state đăng nhập)
│   │   ├── hooks/        # Custom hooks (useDebounce, useUnsavedChanges)
│   │   ├── pages/        # Trang giao diện chính (Home, About, Courses, FullTest, Exams)
│   │   │   └── admin/    # Trang Admin (Dashboard, Users, Attempts, Analytics, Settings, Trash, etc.)
│   │   ├── services/     # Các hàm gọi API Axios (examService, userService, adminService...)
│   │   ├── utils/        # Axios interceptor, format điểm IELTS, format ngày tháng
│   │   ├── App.jsx       # Routing client-side & Lazy loading setup
│   │   └── main.jsx      # Entry point React application
│   ├── package.json
│   └── vite.config.js
└── render.yaml           # Cấu hình tự động deploy trên Render.com
```

---

### Các Entry Point chính
* **Backend**: [backend/server.js](file:///d:/Duy/ielts-app/backend/server.js) — Khởi chạy Express HTTP server trên port 3001 (hoặc PORT môi trường).
* **Frontend**: [frontend/src/main.jsx](file:///d:/Duy/ielts-app/frontend/src/main.jsx) -> [frontend/src/App.jsx](file:///d:/Duy/ielts-app/frontend/src/App.jsx) — Quản lý tuyến đường Client-side Routing và Lazy Loading component.

---

## 2. DANH SÁCH MODULE / CHỨC NĂNG

### Phân quyền người dùng (Role System)
1. **User / Student (`role: "user"`)**: Người học thông thường.
2. **Teacher (`role: "teacher"`)**: Giáo viên/Trợ giảng có quyền truy cập Admin Panel để quản lý bài thi, bài tập và xem thống kê.
3. **Admin (`role: "admin"`)**: Quyền quản trị tối cao (Bao gồm toàn bộ quyền Teacher + Quản lý User, Tài khoản Staff, Cấu hình hệ thống, Quản lý Series).

### Chi tiết các Module

| Module | File / Thư mục chính | Chức năng chính | Vai trò truy cập |
|---|---|---|---|
| **Xác thực (Auth)** | `routes/auth.js`, `AuthContext.jsx`, `AuthModal.jsx`, `ChangePassword.jsx` | Đăng ký, Đăng nhập, Đổi mật khẩu bắt buộc, Cấp JWT Token | Tất cả |
| **Thi Full Test (Exams)** | `routes/reading.js`, `listening.js`, `writing.js`, `speaking.js`, `ReadingExam.jsx`, `ListeningExam.jsx`, `WritingExam.jsx`, `SpeakingExam.jsx` | Làm bài thi full-length, tự động chấm điểm bài Reading/Listening, gửi AI chấm điểm Writing/Speaking | User, Teacher, Admin |
| **Kết quả & Lịch sử** | `routes/fulltest.js`, `routes/user.js`, `FullTestResult.jsx`, `SkillResult.jsx`, `UserProfile.jsx` | Xem bảng điểm chi tiết, giải thích đáp án, nhận xét AI feedback và lịch sử làm bài | User, Teacher, Admin |
| **Luyện tập (Practice)** | `routes/practice.js`, `PracticeList.jsx`, `PracticeExamPage.jsx`, `ReadingPractice.jsx`, `ListeningPractice.jsx` | Ôn luyện bài thi ngắn theo từng kỹ năng Reading/Listening | User, Teacher, Admin |
| **Bài mẫu (Samples)** | `routes/samples.js`, `WritingSamplesPage.jsx`, `SpeakingSamplesPage.jsx`, `SampleDetailPage.jsx`, `WritingSamples.jsx`, `SpeakingSamples.jsx` | Xem bài mẫu Band cao kèm phân tích cho Writing và Speaking | Tất cả |
| **Quản lý Đề thi (Admin Exams)** | `routes/admin/exams/`, `Admin.jsx`, `ExamList.jsx`, `ReadingTab.jsx`, `ListeningTab.jsx`, `WritingTab.jsx`, `SpeakingTab.jsx` | Tạo, sửa, xóa, lọc và phân trang các đề thi IELTS 4 kỹ năng | Teacher, Admin |
| **Cambridge AI Import** | `routes/admin/cambridge.js`, `services/cambridge/`, `CambridgeTab.jsx` | Upload PDF sách Cambridge, dùng Groq AI tự bóc tách passage, section, câu hỏi và lưu tự động vào DB | Admin |
| **Dashboard & Analytics** | `routes/admin/dashboard.js`, `Dashboard.jsx`, `Analytics.jsx` | Báo cáo thống kê lượt thi, phân bố Band score, biểu đồ tăng trưởng (SWR Cached 60s) | Teacher, Admin |
| **Quản lý Lịch sử thi (Attempts)** | `routes/admin/dashboard.js`, `Attempts.jsx` | Tra cứu lịch sử làm bài thi của học viên, lọc theo Band score, xuất file Excel streaming | Teacher, Admin |
| **Quản lý Người dùng & Staff** | `routes/admin/users.js`, `Users.jsx`, `UserDetail.jsx`, `Accounts.jsx`, `Staff.jsx` | Quản lý thông tin học viên, khóa/mở khóa tài khoản, phân quyền Staff | Admin |
| **Cấu hình Hệ thống & Trash** | `routes/admin/trash.js`, `Settings.jsx`, `Trash.jsx` | Cấu hình thông báo toàn trang, khôi phục hoặc xóa vĩnh viễn các mục trong thùng rác | Admin (Settings), Teacher (Trash) |

---

## 3. VẤN ĐỀ PHÁT HIỆN ĐƯỢC

### Code Smell & File quá dài
* **Kích thước file lớn**:
  * Frontend có một số component trang thi và quản trị có độ dài lớn (~500–700 dòng): [ReadingExam.jsx](file:///d:/Duy/ielts-app/frontend/src/pages/ReadingExam.jsx) (~31KB), [PracticeExamPage.jsx](file:///d:/Duy/ielts-app/frontend/src/pages/PracticeExamPage.jsx) (~30KB), [ReadingPractice.jsx](file:///d:/Duy/ielts-app/frontend/src/pages/admin/ReadingPractice.jsx) (~28KB), [ReadingTab.jsx](file:///d:/Duy/ielts-app/frontend/src/components/admin/ReadingTab.jsx) (~32KB). Các file này chứa logic state phức tạp của nhiều loại câu hỏi, nên cân nhắc tách nhỏ hơn nếu cần bảo trì lâu dài.
* **File Script cũ trong `scripts/archive/`**:
  * Thư mục `backend/scripts/archive/` chứa các script migration cũ (`migrate-data.js`, `sync-exams-v2.js`, `sync-exams-v3.js`). Cần lưu ý không chạy nhầm các script này trên môi trường Production.

### Console Logs
* Lệnh `console.log` trong `backend/routes/admin/cambridge.js` được bọc an toàn dưới điều kiện `if (process.env.NODE_ENV !== 'production')`, không ảnh hưởng đến hiệu năng Production nhưng gây ra một số log debug khi chạy ở môi trường local dev.

### Broken Import / Import hỏng
* **Không có**. Đã kiểm tra toàn bộ ứng dụng qua test suite (`npm run test` backend/frontend) và lệnh `npm run build` frontend đạt kết quả 100% thành công.

---

## 4. API / BACKEND

### Danh sách Endpoint chính

| Method | Path | Mục đích | Validation / Authorization |
|---|---|---|---|
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Zod Schema (`registerSchema`) |
| `POST` | `/api/auth/login` | Đăng nhập & lấy JWT Token | Zod Schema (`loginSchema`) |
| `POST` | `/api/auth/change-password` | Đổi mật khẩu | Authenticated JWT |
| `GET` | `/api/reading/exams` | Lấy danh sách đề Reading công khai | Public |
| `GET` | `/api/reading/exams/:id` | Lấy chi tiết bài thi Reading | Authenticated JWT |
| `POST` | `/api/reading/exams/:id/submit` | Nộp bài thi Reading & chấm điểm | Authenticated JWT + Zod |
| `POST` | `/api/writing/exams/:id/submit` | Nộp bài Writing & gọi AI chấm điểm | Authenticated JWT + Zod |
| `POST` | `/api/speaking/exams/:id/submit` | Nộp bài Speaking & gọi AI chấm điểm | Authenticated JWT + Zod |
| `GET` | `/api/admin/dashboard` | Lấy số liệu thống kê Dashboard | Teacher/Admin + SWR Cache |
| `GET` | `/api/admin/analytics` | Lấy dữ liệu biểu đồ phân tích | Teacher/Admin + SWR Cache |
| `GET` | `/api/admin/attempts` | Lấy lịch sử làm bài (Search/Band Filter/Pagination) | Teacher/Admin + Zod (`attemptsQuerySchema`) |
| `GET` | `/api/admin/attempts/export` | Xuất lịch sử thi ra file Excel (.xlsx) | Teacher/Admin + Zod |
| `GET` | `/api/admin/exams` | Lấy danh sách đề thi Admin (Pagination & Search) | Teacher/Admin |
| `GET` | `/api/admin/exams/counts` | Lấy số lượng đề thi theo từng kỹ năng | Teacher/Admin |
| `POST` | `/api/admin/cambridge/upload-pdf` | Upload file PDF đề Cambridge | Admin Only |
| `POST` | `/api/admin/cambridge/extract-save` | Trích xuất câu hỏi từ PDF qua Groq AI & lưu DB | Admin Only + Zod |
| `GET` | `/api/admin/users` | Lấy danh sách người dùng học viên | Admin Only |
| `PUT` | `/api/admin/users/:id/lock` | Khóa / Mở khóa tài khoản học viên | Admin Only |

---

## 5. DATABASE

### Schema Summary (Prisma ORM)
* **User**: Quản lý tài khoản (`id`, `email`, `password`, `name`, `role`, `isLocked`, `requirePasswordChange`, `createdAt`).
* **Exam**: Đề thi 4 kỹ năng (`id`, `title`, `skill`, `bookNumber`, `testNumber`, `seriesId`, `createdAt`, `deletedAt`).
* **Passage / ListeningSection**: Bài đọc Reading hoặc Section nghe Listening (`examId`, `number`, `title`, `body`/`transcript`).
* **QuestionGroup**: Nhóm câu hỏi chia theo loại (`sectionId`/`passageId`, `type`, `qNumberStart`, `qNumberEnd`, `instruction`, `imageUrl`).
* **Question**: Câu hỏi trắc nghiệm/điền từ (`passageId`, `listeningSectionId`, `groupId`, `type`, `questionText`, `options` JSON, `correctAnswer`).
* **WritingTask / SpeakingPart / SpeakingQuestion**: Cấu phần đề thi tự luận Writing & Speaking.
* **Attempt**: Lượt làm bài thi (`userId`, `examId`, `score`, `aiFeedback`, `answers`, `finishedAt`, `createdAt`).
* **QuestionAnswer**: Chi tiết đáp án từng câu trong lượt thi (`attemptId`, `questionId`, `userAnswer`, `isCorrect`).
* **WritingAnswer / SpeakingAnswer**: Bài làm và kết quả chấm AI kỹ năng Writing/Speaking.
* **PracticeExam / PracticeQuestion**: Đề luyện tập độc lập ngắn.
* **WritingSample / SpeakingSample**: Bài mẫu tham khảo.
* **ExamSeries / Series / BookCover / SeriesExam / SeriesMapping**: Quản lý các bộ sách (Cambridge, Practice Plus) và ảnh bìa.

### Indexes quan trọng trên Database
* `Attempt`:
  * `@@index([userId])`
  * `@@index([examId])`
  * `@@index([finishedAt, createdAt])`
  * `@@index([userId, score])`
  * `@@index([examId, score])` (Tối ưu tính Band TB cho danh sách đề thi)
* `Exam`: `@@index([skill])`, `@@index([seriesId, bookNumber, testNumber])`.

---

## 6. GHI CHÚ RỦI RO KHI SỬA CODE

1. **Hàm tính điểm IELTS (`backend/lib/scoreUtils.js`)**:
   * Chứa bảng quy đổi điểm Reading/Listening Raw Score -> IELTS Band Score (0.0 – 9.0).
   * **Cảnh báo**: Logic này được dùng chung trên toàn hệ thống (`reading.js`, `listening.js`, `fulltest.js`, `series.js`). Bất kỳ thay đổi nào trong file này đều tác động trực tiếp tới toàn bộ kết quả thi của học viên.

2. **Ràng buộc Xóa lCascade (`onDelete: Cascade`) trong Prisma Schema**:
   * Khi xóa `Exam` hoặc `Passage`, Prisma sẽ tự động xóa toàn bộ các câu hỏi `Question`, nhóm `QuestionGroup` và chi tiết câu trả lời `QuestionAnswer` thuộc về bài thi đó.
   * **Khuyến nghị**: Nên dùng cơ chế Soft Delete (`deletedAt`) thay vì xóa cứng (`prisma.exam.delete`) để tránh mất dữ liệu liên quan.

3. **Cơ chế Cache SWR & Debounce**:
   * **Backend**: Cache SWR tại `routes/admin/dashboard.js` lưu dữ liệu thống kê 60 giây. Nếu sửa logic ghi DB mà không xóa cache, dữ liệu thống kê sẽ trễ 60s mới cập nhật.
   * **Frontend**: Hook `useDebounce` (400ms) được áp dụng tại các ô tìm kiếm (`Attempts.jsx`, `Users.jsx`, `ExamList.jsx`). Khi sửa giao diện tìm kiếm, phải giữ nguyên wrapper `useDebounce` để tránh tái diễn lỗi bắn API liên tục.
