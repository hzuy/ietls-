# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`/backend`)
```bash
npm run dev          # Dev server with nodemon (port 3001)
npm start            # Production server
npm run build        # npx prisma generate
npm run test         # Run Vitest suite
npm run test:watch   # Watch mode
npm run test:coverage
```

### Frontend (`/frontend`)
```bash
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run Vitest suite
npm run test:watch
npm run test:coverage
```

### Database
```bash
cd backend
npx prisma migrate deploy   # Apply migrations
npx prisma generate         # Regenerate Prisma Client
npx prisma db seed          # Seed sample data
npx prisma studio           # GUI to inspect DB
```

### Docker
```bash
docker-compose up --build   # Build and run backend container
```

## Architecture

Full-stack IELTS exam practice app. Backend is Express 5 + Prisma + PostgreSQL on port 3001. Frontend is React 19 + React Router 7 + Tailwind CSS 4 + Vite on port 5173.

### Backend structure
- `server.js` — Express entry point, CORS config, route mounting
- `routes/` — One file per skill: `reading.js`, `listening.js`, `writing.js`, `speaking.js`, `auth.js`, `fulltest.js`, `stats.js`, `chatbot.js`, plus `home.js`, `practice.js`, `samples.js`, `user.js`. Admin logic lives under `routes/admin/` (see below), mounted from `routes/admin.js`.
- `routes/admin/` — `dashboard.js`, `examSeries.js`, `trash.js`, `uploads.js`, `users.js`, and `exams/` (`core.js` + one file per skill: `reading.js`, `listening.js`, `writing.js`, `speaking.js`) for exam CRUD.
- `middleware/` — JWT auth (`authenticateToken`), admin check (`isAdmin`)
- `prisma/schema.prisma` — Full DB schema (15+ models)
- `lib/` — `prisma.js` (singleton client), `scoreUtils.js` (band conversion), `groqClient.js` (lazy Groq init)
- `validators/` — Zod schemas for request validation
- `uploads/` — Audio/image files served via Express static (gitignored; use cloud storage in prod)

### Frontend structure
- `src/App.jsx` — All routes + `PrivateRoute` / `AdminRoute` / `StaffRoute` wrappers
- `src/pages/` — 40+ lazy-loaded page components
- `src/services/` — Axios API wrappers: `examService.js`, `adminService.js`, `authService.js`, etc.
- `src/context/AuthContext.jsx` — Auth state (user, token) stored in localStorage
- `src/utils/axiosInstance.js` — Axios instance that auto-injects `Authorization: Bearer <token>` and handles 401s

### Auth flow
Login → JWT (7-day) stored in localStorage → Axios interceptor injects token → 401 clears localStorage and redirects to `/`.

### Scoring
- **Reading/Listening**: Fixed raw-score → band lookup table in `scoreUtils.js`
- **Writing/Speaking**: Groq API (`llama-3.3-70b-versatile`) evaluates 4 criteria → returns JSON with per-criterion scores → averaged and rounded to nearest 0.5
- **Full Test**: Average of all 4 skill bands; ≥0.75 rounds up, ≥0.25 → 0.5

### AI integration
Groq is used for:
1. Writing/Speaking scoring (llama-3.3-70b-versatile)
2. Audio transcription (Whisper via Groq)
3. Chatbot assistant

Groq client is lazily initialized in `lib/groqClient.js` to avoid errors when `GROQ_API_KEY` is absent at module load time.

### CORS
Allowed origins: `http://localhost:5173` and `FRONTEND_URL` env var if set (e.g. `https://hzuy.net`).

## Environment variables

**Backend** (`backend/.env`):
```
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ielts_app
JWT_SECRET=<random 32+ chars>
GROQ_API_KEY=gsk_...
PORT=3001                  # optional
FRONTEND_URL=https://...   # optional, added to CORS allowlist
```

**Frontend** (`frontend/.env`):
```
VITE_API_URL=http://localhost:3001/api
```

## Testing

Backend tests live in `backend/routes/*.test.js` (Vitest). Frontend tests in `frontend/src/**/*.test.{js,jsx}`. CI runs both on push/PR to main via GitHub Actions.

Run a single test file:
```bash
cd backend && npx vitest run routes/auth.test.js
cd frontend && npx vitest run src/hooks/useDebounce.test.js
```

## Deployment

- Backend: Docker via `docker-compose.yml` on a self-hosted VPS. `backend/Dockerfile` uses `node:20-slim` + openssl for Prisma libssl compatibility. Container binds to `127.0.0.1:5001`; Nginx reverse proxy handles HTTPS and forwards to it.
- Frontend: Static build (`npm run build`) served by Nginx directly.
- `FRONTEND_URL` env var (e.g. `https://hzuy.net`) must be set in `backend/.env` so it is added to the CORS allowlist.

## Project Status

### Fully implemented and stable

- **Reading** — CRUD, exam list/detail, answer submission with band scoring, detailed result breakdown by question type, draft auto-save (30 s), resume & preview modes, max-attempts enforcement. Tests exist in `routes/reading.test.js`.
- **Listening** — Same feature set as Reading; handles all section/question types (MCQ, note completion, map diagram, matching headings). Tests in `routes/listening.test.js`.
- **Writing** — Submission triggers background Groq AI grading (`llama-3.3-70b-versatile`) on 4 criteria (task_achievement, coherence_cohesion, lexical_resource, grammatical_range); frontend polls `GET /answers/:id/status`; criterion scores logged to `WritingCriterionLog`. Tests in `routes/writing.test.js`.
- **Speaking** — Speech recorded via Web Speech API; Groq Whisper transcription fallback for non-Chrome; background AI grading on 4 criteria (fluency, vocabulary, grammar, pronunciation); criterion scores logged to `SpeakingCriterionLog`. Tests in `routes/speaking.test.js`.
- **Full Test** — 4-skill coordination, results only unlocked when all skills done; parallel DB queries (reduced ~200 sequential queries to 4). No dedicated test file.
- **Stats / Progress Analysis** — Error breakdown by question type, trend charts, per-criterion trend badges for Writing & Speaking, AI Advisor endpoint (`POST /stats/advice`, rate-limited 5/user/day). Tests in `routes/stats.test.js`.
- **Chatbot** — Context-aware assistant (pulls user stats + band history); rate-limited 20 messages/user/hour; system-prompt injection protection; conversation capped at 6 messages. Tests in `routes/chatbot.test.js`.
- **Admin panel** — Full CRUD for all content types (Reading, Listening, Writing, Speaking exams; Series/Books; Writing & Speaking samples; Users); soft-delete / Trash recovery; image & audio upload. Sub-routes under `backend/routes/admin/`. (The Cambridge PDF import pipeline was removed — unused, 0 real attempts, produced flat questions the group-based editors couldn't round-trip.)
- **Auth / User profile** — Register, login (bcryptjs + JWT 7-day), profile page, password change, streak tracking.
- **Series & Practice** — Browse/manage exam series and standalone practice exams; leaderboard per series.
- **Cloud Storage & Media Management (Phase 4)** — Module `storageService` tích hợp Cloudinary SDK tự động upload ảnh đề thi, audio Listening và thumbnail WebP tối ưu; có cơ chế fallback cục bộ mượt mà về `backend/uploads/` khi không cấu hình Cloud credentials để dev/test luôn hoạt động; Groq Whisper STT hỗ trợ stream audio trực tiếp từ Cloud URLs.
- **Rate Limiting Submission Endpoints (Phase 4)** — Sử dụng `express-rate-limit` bảo vệ các endpoint nộp bài (`/reading/exams/:id/submit`, `/listening/exams/:id/submit`, `/writing/exams/:id/submit`, `/speaking/exams/:id/submit`, và các retry endpoint): định danh độc lập theo `userId`, giới hạn 20 lượt/15 phút cho Reading/Listening và 10 lượt/15 phút cho Writing/Speaking, trả về mã 429 kèm thông báo tiếng Việt thân thiện, ngăn chặn spam và bảo vệ quota Groq AI.

### Present but with known gaps / not fully tested

- **Admin → Users & Accounts pages** (`admin/UserDetail.jsx`, `admin/Accounts.jsx`) — BUG-06: "showing X of Y" count display incomplete; BUG-07: some action handlers (ban/reset) wired up but not confirmed end-to-end; BUG-21: role-change guard (admin-only) implemented but not covered by tests.
- **Admin → SeriesManager** (`admin/SeriesManager.jsx`) — BUG-08: duplicate `testNumber` validation client-side only, no backend constraint; BUG-09: deleted test count badge present but may not reflect real-time state; BUG-10: single-series fetch path implemented but untested in isolation.
- **Admin → Analytics** (`admin/Analytics.jsx`) — BUG-19: shared bar-chart component referenced but wiring to teacher-only data path is partially stubbed; teacher analytics link on Dashboard exists but content coverage unclear.

### Not implemented / skeleton only

- No email verification or password-reset flow.
- No HTTPS / TLS termination inside the app (expected to be handled by reverse proxy).

### TODO / FIXME comments found in source

| Tag | File | Description | Status |
|-----|------|-------------|--------|
| BUG-06 | `frontend/src/pages/admin/UserDetail.jsx:113` | "Showing X of Y" displayed vs total count incomplete | **DONE** (Phân trang hiển thị chính xác `shownAttempts` vs `totalAttempts` + test) |
| BUG-07 | `frontend/src/pages/admin/UserDetail.jsx:37,80,157` | Action handlers (ban, reset, etc.) need end-to-end verification | **DONE** (Hoàn thiện `handleToggleLock`, `handleResetPassword`, `handleDelete` + unit tests) |
| BUG-08 | `frontend/src/pages/admin/SeriesManager.jsx:78` | Duplicate `testNumber` validation is client-side only | **DONE** (Bổ sung `checkDuplicateExamTest` trả về 409 ở backend + check bookNumber + tests) |
| BUG-09 | `frontend/src/pages/admin/SeriesManager.jsx:282` | Deleted test count badge may be stale | **DONE** (Đồng bộ real-time badge qua `notifyTrashChanged()` trên toàn bộ thao tác xóa/khôi phục) |
| BUG-10 | `frontend/src/pages/admin/SeriesManager.jsx:44` | Single-series fetch path | **DONE** (Tái cấu trúc sang `CambridgeTab` & `CambridgeBookComponents` với live cache invalidation) |
| BUG-13 | `frontend/src/pages/admin/ReadingPractice.jsx:164,169` | Unsaved-changes guard / dirty navigation block | **DONE** (Bổ sung `handleCancelOrBack` với `NAV_LEAVE_MSG` confirm trước khi đổi view) |
| BUG-13 | `frontend/src/pages/admin/ListeningPractice.jsx:164,169` | Same as above for Listening editor | **DONE** (Bổ sung `handleCancelOrBack` với `NAV_LEAVE_MSG` confirm trước khi đổi view) |
| BUG-14 | `frontend/src/pages/admin/WritingSamples.jsx:34,41,52` | Draft auto-save for writing samples editor | **DONE** (Hợp nhất trong `SampleManager` với `useDraftPersistence` 2s/30s) |
| BUG-15 | `frontend/src/pages/admin/WritingSamples.jsx:95` | Validate content not empty before save | **DONE** (Chặn lưu khi rỗng tiêu đề/nội dung qua `plainContent.trim()` + test) |
| BUG-15 | `frontend/src/pages/admin/SpeakingSamples.jsx:96` | Same validation for speaking samples | **DONE** (Chặn lưu khi rỗng tiêu đề/nội dung qua `plainContent.trim()` + test) |
| BUG-19 | `frontend/src/pages/admin/Analytics.jsx:12` | Shared bar-chart component wiring | Chờ audit riêng |
| BUG-19 | `frontend/src/pages/admin/Dashboard.jsx:255` | Teacher charts link | Chờ audit riêng |
| BUG-21 | `frontend/src/pages/admin/Accounts.jsx:129` | Enforce admin-only role changes | **DONE** (Backend guard 403 cho role modification + 9 unit tests trong `adminUsers.test.js`) |
| BUG-26 | `backend/routes/reading.js:142` | `max_attempts_per_exam` setting enforcement | **DONE** (Chặn nộp bài trả 429 khi vượt max_attempts + unit tests trong `reading.test.js`) |
| BUG-26 | `backend/routes/listening.js:141` | Same for Listening | **DONE** (Chặn nộp bài trả 429 khi vượt max_attempts + unit tests trong `listening.test.js`) |
| BUG-26 | `backend/routes/writing.js:175` | Same for Writing | **DONE** (Chặn nộp bài trả 429 khi vượt max_attempts + unit tests trong `writing.test.js`) |
| BUG-28 | `backend/routes/admin/trash.js` | Auto-purge soft-deleted items older than 30 days — **DONE**. Fire-and-forget IIFE inside `GET /admin/trash` hard-deletes anything with `deletedAt` older than 30 days. Not a real cron: only runs when an admin/teacher opens the Trash page. Before the P0-1 fix it silently failed (FK violation) for any exam that had `AnswerLog` rows; now `hardDeleteExams` clears `AnswerLog` + wraps the chain in `$transaction`, so it completes. | **DONE** |

### Known issues — cần audit riêng sau

- **`PUT /admin/exams/:id` tái sinh toàn bộ Question ID mỗi lần sửa đề — ĐÃ ĐƯỢC XỬ LÝ.**
  Đã refactor `routes/admin/exams/core.js` cùng `reading.js` và `listening.js` sang cơ chế diff-based upsert toàn phần bọc trong `prisma.$transaction`:
  1. Giữ nguyên ID của `Passage` và `ListeningSection` hiện có bằng cách match theo `p.id`/`s.id` hoặc `number`.
  2. Diffing `QuestionGroup` theo `id` hoặc `sortOrder`.
  3. Diffing `Question` ưu tiên match theo `q.id` (nếu client gửi lên) và fallback theo `q.number`. Cập nhật in-place các field thay đổi (`questionText`, `correctAnswer`, `options`, `type`, v.v.), chỉ tạo mới câu hỏi thực sự thêm và xóa câu hỏi thực sự bớt.
  4. Nếu có câu hỏi cần xóa mà đã có `QuestionAnswer` hoặc `AnswerLog` của học viên, pipeline chặn ngay lập tức và trả mã lỗi `409 Conflict` (kèm danh sách chi tiết các câu bị chặn), không để xảy ra mồ côi hoặc đứt gãy khóa ngoại.
  5. Hỗ trợ đầy đủ các nhóm câu hỏi đặc thù: `matching_headings` (cập nhật `matchingOptions`), `diagram_label` (ánh xạ `hint` sang `questionText`, `type: 'fill_blank'`).
  6. Frontend `ReadingTab` và `ListeningTab` giữ nguyên `id` của passage/section, questionGroup và question trong `loadForEdit` và gửi kèm trong `payload` PUT.

- **Editor câu hỏi tồn tại 2 bản implementation song song đã fork khác nhau — ĐÃ ĐƯỢC XỬ LÝ (Phase 3).**
  Đã hợp nhất hoàn toàn 4 question editors (`MCQGroupEditor`, `MatchingEditor`, `NoteCompletionEditor`, `TableCompletionEditor`) vào một nguồn chuẩn duy nhất tại `frontend/src/components/admin/editors/`:
  1. Hỗ trợ đầy đủ các tham số cấu hình: `numberingMode: 'auto' | 'manual'`, `themeSource: 'admin' | 'practice'`.
  2. Tích hợp trọn vẹn các tính năng hoàn thiện nhất: `maxChoices` (1..10), cảnh báo chọn X/maxChoices, re-index & cleanup `correctAnswer` an toàn khi xóa option, duplicate option warnings, upload diagram map, và `syncQuestionsToTokens` chống mồ côi câu hỏi.
  3. Cập nhật import tại `PracticeGroupCard.jsx`, `ReadingGroupEditor.jsx`, `ListeningTab.jsx`.
  4. Đã xóa an toàn 4 file trùng lặp trong `frontend/src/components/practice/`.

- **Auto-renumber cho câu hỏi loại token-based (note/table/summary/diagram) (P1-3) — ĐÃ ĐƯỢC XỬ LÝ.**
  Đã cập nhật `recalcAllGroupNumbers` (dùng chung cho Reading và Listening) và `recalcGroups` trong `utils/practiceConfig.js`:
  1. Quét toàn bộ token `[Q:n]` trong `noteSections` theo thứ tự xuất hiện.
  2. Tạo bản đồ mapping `oldNum -> newStart + idx` và rewrite token một lượt qua Regex replacer chống va chạm số (`replace(/\[Q:(\d+)\]/g, ...)`).
  3. Quét và cập nhật lại `Question.number` cho từng câu hỏi con theo đúng số mới, đồng thời bảo toàn `id` và các thuộc tính khác.
  4. Hỗ trợ cả `diagram_label` (tự động renumber questions theo `newStart + idx` dù không có text token).
  5. Đảm bảo logic scoring ở backend (`routes/reading.js` / `routes/listening.js`) và breakdown kết quả luôn khớp 100% khoảng `[qNumberStart, qNumberEnd]`.

- **`ReadingTab` thiếu 3 cơ chế UX/a11y mà `ListeningTab` đã có — ĐÃ ĐƯỢC XỬ LÝ (Phase 3).**
  Đã port hoàn chỉnh 3 cơ chế từ `ListeningTab` sang `ReadingTab`:
  1. **Validate trước submit**: Chặn submit khi passage thiếu title hoặc body rỗng; chặn khi passage có nhóm câu hỏi nhưng nhóm có 0 câu; hiển thị `window.confirm` cảnh báo nếu tổng số câu của đề ≠ 40.
  2. **Error banner persistent thay cho `alert()`**: Thay thế triệt để `alert()` khi `loadForEdit` lỗi hoặc submit lỗi bằng Error Banner đỏ cố định ở đầu form và tự động cuộn lên đầu form (`formRef.current?.scrollIntoView`); dùng Toast notification đồng bộ hệ thống cho các thông báo thao tác.
  3. **Trợ năng (a11y) Accordion Passage**: Nút toggle có `aria-expanded` và `aria-controls`, panel nội dung có `id`, `role="region"`, và `aria-label={"Đoạn văn " + (index + 1)}`.

- **Cache tab kỹ năng bị cũ (stale) sau khi xóa cuốn ở `CambridgeTab` — ĐÃ ĐƯỢC XỬ LÝ (Phase 4).**
  Đã hoàn thiện cơ chế đồng bộ dọn dẹp cache giữa `CambridgeTab` và `Admin.jsx`:
  1. `CambridgeTab.jsx` kích hoạt `onExamsChanged?.()` trên tất cả các thao tác thay đổi bộ đề/cuốn (thêm, sửa tên, xóa bộ đề; thêm, đổi số, xóa cuốn; upload ảnh bìa cuốn).
  2. `Admin.jsx` xử lý `handleExamsChanged`: gọi `fetchCounts()`, tải lại `getExamSeries()`, xóa sạch cache `tabCache` của cả 4 kỹ năng (`reading`, `listening`, `writing`, `speaking`), và nếu đang mở một tab kỹ năng thì tự động gọi `fetchSkillExams(activeTab, { force: true })` ngay lập tức.
  3. `Admin.jsx` đăng ký lắng nghe sự kiện `onTrashChanged` từ `adminService`, tự động làm mới danh sách đề thi và bộ đề khi admin khôi phục hoặc xóa vĩnh viễn trong Thùng rác mà không cần tải lại trang (F5).

