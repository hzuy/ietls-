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
- `routes/` — One file per skill: `reading.js`, `listening.js`, `writing.js`, `speaking.js`, `auth.js`, `admin.js`, `fulltest.js`, `stats.js`, `chatbot.js`
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

### Present but with known gaps / not fully tested

- **Admin → Users & Accounts pages** (`admin/UserDetail.jsx`, `admin/Accounts.jsx`) — BUG-06: "showing X of Y" count display incomplete; BUG-07: some action handlers (ban/reset) wired up but not confirmed end-to-end; BUG-21: role-change guard (admin-only) implemented but not covered by tests.
- **Admin → SeriesManager** (`admin/SeriesManager.jsx`) — BUG-08: duplicate `testNumber` validation client-side only, no backend constraint; BUG-09: deleted test count badge present but may not reflect real-time state; BUG-10: single-series fetch path implemented but untested in isolation.
- **Admin → Analytics** (`admin/Analytics.jsx`) — BUG-19: shared bar-chart component referenced but wiring to teacher-only data path is partially stubbed; teacher analytics link on Dashboard exists but content coverage unclear.
- **`correctAnswer.security.test.js`** — Untracked file in repo root (not inside `routes/`); not wired into the Vitest config; needs to be moved and registered.

### Not implemented / skeleton only

- No rate limiting on Reading/Listening/Writing/Speaking submission endpoints (only Chatbot and AI Advice are rate-limited).
- No cloud storage integration — uploaded audio/images go to `backend/uploads/` (local disk); production deployment note exists in README but no S3/Cloudinary code is present.
- No email verification or password-reset flow.
- No HTTPS / TLS termination inside the app (expected to be handled by reverse proxy).

### TODO / FIXME comments found in source

| Tag | File | Description |
|-----|------|-------------|
| BUG-06 | `frontend/src/pages/admin/UserDetail.jsx:113` | "Showing X of Y" displayed vs total count incomplete |
| BUG-07 | `frontend/src/pages/admin/UserDetail.jsx:37,80,157` | Action handlers (ban, reset, etc.) need end-to-end verification |
| BUG-08 | `frontend/src/pages/admin/SeriesManager.jsx:78` | Duplicate `testNumber` validation is client-side only |
| BUG-09 | `frontend/src/pages/admin/SeriesManager.jsx:282` | Deleted test count badge may be stale |
| BUG-10 | `frontend/src/pages/admin/SeriesManager.jsx:44` | Single-series fetch path |
| BUG-13 | `frontend/src/pages/admin/ReadingPractice.jsx:164,169` | Unsaved-changes guard / dirty navigation block |
| BUG-13 | `frontend/src/pages/admin/ListeningPractice.jsx:164,169` | Same as above for Listening editor |
| BUG-14 | `frontend/src/pages/admin/WritingSamples.jsx:34,41,52` | Draft auto-save for writing samples editor |
| BUG-15 | `frontend/src/pages/admin/WritingSamples.jsx:95` | Validate content not empty before save |
| BUG-15 | `frontend/src/pages/admin/SpeakingSamples.jsx:96` | Same validation for speaking samples |
| BUG-19 | `frontend/src/pages/admin/Analytics.jsx:12` | Shared bar-chart component wiring |
| BUG-19 | `frontend/src/pages/admin/Dashboard.jsx:255` | Teacher charts link |
| BUG-21 | `frontend/src/pages/admin/Accounts.jsx:129` | Enforce admin-only role changes |
| BUG-26 | `backend/routes/reading.js:142` | `max_attempts_per_exam` setting enforcement (implemented, needs test) |
| BUG-26 | `backend/routes/listening.js:141` | Same for Listening |
| BUG-26 | `backend/routes/writing.js:175` | Same for Writing |
| BUG-28 | `backend/routes/admin/trash.js:56` | Auto-purge soft-deleted items older than 30 days |

### Known issues — cần audit riêng sau

- **`PUT /admin/exams/:id` tái sinh toàn bộ Question ID mỗi lần sửa đề.** Route này `passage.deleteMany` + tạo lại tất cả passage/question với ID mới trên mỗi lần cập nhật nội dung. Hệ quả: `attempt.answers` (JSON key theo questionId) và các dòng `QuestionAnswer` của những lượt thi ĐÃ tồn tại trước khi sửa đề bị lệch/mồ côi — không tái chấm lại được, và breakdown chi tiết theo từng câu của lượt cũ bị mất. Cần audit riêng: có nên **giữ nguyên Question ID khi update** (diff nội dung, chỉ update field thay đổi, chỉ tạo/xóa câu thực sự thêm/bớt) thay vì xóa-tạo-lại, để bảo toàn lịch sử answer của học viên đã làm bài. Ảnh hưởng: tất cả 4 skill dùng chung pattern này trong `routes/admin/exams/core.js` (PUT) + `reading.js`/`listening.js`/`writing.js`/`speaking.js` (POST create).

  **Speaking đã được sửa (commit `03d857c`, B-3) theo cách TỐT HƠN — dùng làm mẫu tham khảo cho Reading/Listening.** Thay vì `speakingPart.deleteMany` + tạo lại, PUT speaking giờ **reuse 3 SpeakingPart cũ** (luôn là Part 1/2/3): chỉ `speakingPart.update` `cueCard` + `speakingQuestion.deleteMany({ partId })` + `createMany` (SpeakingQuestion không có FK ngoài nào trỏ vào nên xóa-tạo-lại vô hại). `SpeakingAnswer` giữ nguyên `partId` → **không mất, không cả mồ côi** (trước đó bị `speakingAnswer.deleteMany` xóa hẳn vì FK `partId` NOT NULL + no cascade). Bọc `$transaction`. Áp dụng tương tự cho Reading/Listening phức tạp hơn — `Passage`/`ListeningSection` cũng cố định về số lượng/thứ tự nên reuse được, nhưng bên trong còn `QuestionGroup` → `Question` (+ `NoteSection`/`NoteLine`/`MatchingOption`) nhiều lớp, và `QuestionAnswer.questionId` là cái cần bảo toàn (khác Speaking — `SpeakingAnswer` trỏ `partId` chứ không phải questionId). Hướng: reuse Passage/Section ID + diff QuestionGroup theo `sortOrder` + diff Question theo `number`, chỉ tạo/xóa cái thực sự thêm/bớt. Khả thi, cần task riêng.

- **Editor câu hỏi tồn tại 2 bản implementation song song đã fork khác nhau.** Mỗi loại (MCQGroup, Matching, NoteCompletion, TableCompletion) có 1 bản ở `frontend/src/components/practice/` và 1 bản ở `frontend/src/components/admin/editors/`. Bản `practice/` được dùng bởi form soạn đề **Reading** (`ReadingTab` → `admin/editors/ReadingGroupEditor` → import từ `practice/`) và 2 trang `ReadingPractice.jsx` / `ListeningPractice.jsx`. Bản `admin/editors/` được dùng bởi form soạn đề **Listening** (`ListeningTab`). 2 bản đã lệch nhau: theme source (`practiceConfig` vs `adminConstants`), `min` của `maxChoices` (2 vs 1), cách đánh số/`qNumberEnd` cho MCQ multi, và các validation/cleanup nhỏ (đợt 4 mới port cảnh báo "chọn X/maxChoices" + dọn `correctAnswer` khi xóa option từ `admin/editors/MCQGroupEditor` sang `practice/MCQGroupEditor`; các bản khác vẫn chưa đồng bộ). Mỗi file có comment `LƯU Ý KIẾN TRÚC` ở đầu trỏ sang bản kia. Cần audit riêng: hợp nhất thành 1 bản tham số hóa (`numberingMode: auto/manual`, `themeSource`) rồi xóa bản trùng.

- **Auto-renumber KHÔNG cập nhật câu hỏi loại token-based (note/table/summary/diagram) — tồn tại ở CẢ Reading LẪN Listening (P1-3).** `recalcAllGroupNumbers` (dùng chung cho Reading qua passages và Listening qua sections — `ListeningTab` đã chuyển sang auto-numbering, bỏ input "Từ câu" thủ công) khi gặp `TOKEN_BASED_TYPES` chỉ ghi lại `qNumberStart`/`qNumberEnd` của nhóm, **không** viết lại token `[Q:n]` trong `noteSections[].lines[].contentWithTokens` cũng như `Question.number` của từng câu con. Hệ quả: nếu một nhóm token-based bị dịch số vì nhóm phía trước nó thay đổi số câu (hoặc bị move), thì `Question.number` (bằng id token gán lúc chèn) sẽ lệch khỏi khoảng `[qNumberStart, qNumberEnd]` mới. UI admin + trang làm bài hiển thị số theo `qNumberStart + vị-trí` nên trông vẫn đúng, nhưng scoring và result-detail (`routes/reading.js` / `routes/listening.js`) lọc câu bằng `q.number >= g.qNumberStart && q.number <= g.qNumberEnd` → sẽ **loại nhầm** các câu token bị lệch (không chấm, không hiện trong breakdown). **Dữ liệu thật hiện CHƯA bị ảnh hưởng** (audit 08/2026: mọi nhóm note-completion trong 4 đề Listening đều đứng đầu section nên `qNumberStart` không đổi; Reading tương tự chưa phát hiện case). Cần audit/sửa riêng cho cả 2 skill: cho `recalcAllGroupNumbers` renumber luôn `Question.number` của câu token + rewrite `[Q:n]` trong content khi khoảng số của nhóm thay đổi.

- **`ReadingTab` thiếu 3 cơ chế UX/a11y mà `ListeningTab` đã có (đảo chiều so với hướng "port từ Reading sang Listening").** Đợt audit ListeningTab (08/2026) xây MỚI cho Listening 3 thứ mà Reading chưa từng có:
  1. **Validate trước submit** — `ListeningTab.handleSubmit` chặn lưu khi có section chứa nhóm câu hỏi nhưng thiếu file audio, hoặc có nhóm 0 câu; và hỏi xác nhận (`window.confirm`) khi tổng số câu ≠ 40. `ReadingTab.handleSubmit` **không có** guardrail nào — chỉ dựa vào `required` của input title + validate backend (không chặn passage rỗng, group 0 câu, thân bài rỗng).
  2. **Error banner persistent thay cho `alert()`** — `ListeningTab` chuyển `loadForEdit` fail → `setError(...)` (banner đỏ trong form, cuộn tới) và `uploadAudio`/`transcribeAudio`/`handleDelete` fail → `showToast(...)`. `ReadingTab` vẫn dùng `alert('Lỗi tải đề để sửa')` / `alert('Lỗi xóa đề')` cho `loadForEdit` và `handleDelete`.
  3. **`aria-expanded` + `aria-controls` cho accordion** — mỗi nút toggle Section trong `ListeningTab` có `aria-expanded`/`aria-controls`, panel có `id` khớp + `role="region"` + `aria-label`. Accordion Passage của `ReadingTab` chưa có gì.

  Đề xuất: khi quay lại `ReadingTab`, port ngược 3 cơ chế này từ `ListeningTab` sang (điều chỉnh "section" → "passage", thêm check thân bài rỗng) để 2 tab đối xứng về UX/a11y thay vì lệch 1 chiều.

- **Cache tab kỹ năng bị cũ (stale) sau khi xóa cuốn/bộ đề ở `CambridgeTab`.** Xóa một `BookCover` (cuốn) hoặc `ExamSeries` (bộ đề) sẽ soft-delete các `Exam` bên trong (`routes/admin/examSeries.js` — `exam.updateMany` set `deletedAt`), nhưng `CambridgeTab` không phát tín hiệu refresh nào lên `Admin.jsx` → cache `tabCache` của các tab Reading/Listening/Writing/Speaking vẫn giữ danh sách cũ; admin phải F5 thủ công mới thấy đúng. Hành vi này có SẴN từ trước đợt audit 08/2026 (`handleDeleteBook`/`handleDeleteSeries` chưa bao giờ gọi `onRefresh`; prop `onRefresh` duy nhất từng có đã bị xóa cùng `PDFImportTab`). Không gấp, không ảnh hưởng dữ liệu — chỉ là cache UX chưa đồng bộ. Hướng sửa: cho `CambridgeTab` nhận lại một callback `onExamsChanged` từ `Admin.jsx` và gọi sau mỗi book/series delete để invalidate `tabCache` cả 4 skill (hoặc chuyển danh sách exam sang fetch tươi khi chuyển tab).
