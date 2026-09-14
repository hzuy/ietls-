# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` (root) mô tả quy trình skill bắt buộc theo giai đoạn (plan → cook → test + security → git/ship → deploy). Đọc file đó trước khi bắt đầu một feature lớn.
> `DEPLOY.md` là runbook deploy production thủ công (server `lab46`, Nginx + Docker + Cloudflare).

## Commands

### Backend (`/backend`)
```bash
npm run dev            # nodemon, port 3001 (ignore uploads/)
npm start              # production
npm run build          # npx prisma generate
npm run test           # Vitest (environment: node)
npm run test:watch
npm run test:coverage
npm run seed:analytics # seed dữ liệu demo cho trang Analytics
```

### Frontend (`/frontend`)
```bash
npm run dev            # Vite, port 5173
npm run build          # dùng .env.production (VITE_* nhúng build-time)
npm run lint           # ESLint 9 flat config
npm run test           # Vitest + jsdom + Testing Library
npm run test:watch
npm run test:coverage
```

### Chạy 1 test file
```bash
cd backend  && npx vitest run routes/reading.test.js
cd frontend && npx vitest run src/hooks/useDebounce.test.js
cd frontend && npx vitest run src/pages/Home.test.jsx -t "resume"   # lọc theo tên test
```

### Database
```bash
cd backend
npx prisma migrate deploy          # apply migrations (prod-safe)
npx prisma migrate dev --name xxx  # dev: tạo migration mới
npx prisma generate
npx prisma studio
node prisma/seed-demo-data.js      # KHÔNG có `prisma db seed` — package.json không khai báo seed
```
⚠️ `DATABASE_URL` ở local **trỏ chung một Supabase DB với production**. Migration chạy ở local là chạy thẳng vào DB prod. Kiểm tra kỹ trước khi `migrate dev` / `migrate deploy`. `npx prisma migrate reset` bị chặn trong `.claude/settings.json` — đúng như vậy, đừng tìm cách lách.

### Docker
```bash
docker compose up -d --build backend   # CHỈ service backend
```
`docker-compose.yml` còn service `postgres-prod` **chưa active** (chuẩn bị cho migration khỏi Supabase, xem `docs/deploy/self-hosted-postgres-migration.md`). Đừng `docker compose up` trần — sẽ dựng thêm Postgres rỗng ngoài ý muốn.

## Architecture

Express 5 + Prisma + PostgreSQL (Supabase) ở port 3001; React 19 + React Router 7 + TanStack Query 5 + Tailwind CSS 4 + Vite ở port 5173. Không dùng TypeScript. Backend là CommonJS, frontend là ESM.

### Hai hệ nội dung song song — điểm dễ nhầm nhất

Đây là chỗ hay gây sửa nhầm file:

| | **Exam** (đề Cambridge / full test) | **PracticeExam** (đề luyện lẻ) |
|---|---|---|
| Model | `Exam` → `Passage`/`ListeningSection` → `QuestionGroup` → `Question` (+ `NoteSection`/`NoteLine`/`MatchingOption`) | `PracticeExam` → `PracticeQuestion` (phẳng) |
| Routes | `routes/reading.js`, `listening.js`, `writing.js`, `speaking.js`, `fulltest.js`; admin CRUD ở `routes/admin/exams/*` | `routes/practice.js` (cả public lẫn admin trong 1 file) |
| Trang | `/full-test`, `/cambridge`, `/practice-plus`, `/reading/:id` | `/practice/reading/:id`, `/practice/listening/:id` |
| Admin UI | `pages/Admin.jsx` + `components/admin/{ReadingTab,ListeningTab,CambridgeTab}.jsx` | `pages/admin/{ReadingPractice,ListeningPractice}.jsx` |

Loại thứ ba: **Samples** (`WritingSample` / `SpeakingSample*`) — bài mẫu chỉ để đọc, `routes/samples.js`, admin ở `pages/admin/SampleManager.jsx`.

### Backend
- `server.js` — CORS allowlist (`localhost:5173` + `FRONTEND_URL`), compression, static `/uploads`, mount routes, và một error handler riêng dịch lỗi Multer (`LIMIT_FILE_SIZE` → 413 JSON, `INVALID_FILE_TYPE` → 400 JSON) thay vì để rơi thành HTML 500.
- `routes/admin.js` chỉ là aggregator: `router.use('/', require('./admin/<x>'))` cho `uploads`, `examSeries`, `exams/{core,reading,listening,writing,speaking}`, `dashboard`, `users`, `trash`. Tất cả cùng mount ở prefix `/api/admin` nên **đường dẫn nằm trong file con** — grep theo path chứ đừng đoán theo tên file.
- `middleware/auth.js` — verify JWT, gán `req.user = { userId, role, ... }`.
- `lib/roles.js` — `adminOnly` / `teacherOrAdmin`. Role: `user` | `teacher` | `admin`. Quyền **không đồng nhất** giữa các trang admin (vd `/admin/users` chỉ admin, `/admin/attempts` cho cả teacher).
- `middleware/validate.js` + `validators/*` (Zod 4). **Quy ước bắt buộc:** với `validate(schema, 'query')`, Express 5 khiến `req.query` là getter-only nên dữ liệu đã validate nằm ở `req.validatedQuery`. Route validate query phải đọc `req.validatedQuery`, không đọc `req.query`.
- `middleware/rateLimiter.js` — `express-rate-limit`, key theo `user_<userId>` (fallback IP). Reading/Listening 20 lượt/15′, Writing/Speaking 10 lượt/15′, trả 429 kèm message tiếng Việt. Tự skip khi `NODE_ENV=test` trừ khi request có header `x-test-rate-limit: true` (hoặc `ENABLE_RATE_LIMIT_IN_TEST=true`) — dùng header này khi viết test rate limit.
- `lib/scoreUtils.js` — bảng raw→band cố định cho Reading/Listening, `roundBand`, `ieltsOverall` (≥.75 lên nguyên, ≥.25 → .5).
- `lib/groqClient.js` — `getGroqClient()` lazy (không init lúc load module để test không cần key) và **`getGroqModel()`**: tên model text tập trung một chỗ, mặc định `openai/gpt-oss-120b`, override bằng `GROQ_MODEL`. Groq gỡ model khá thường xuyên (`llama-3.3-70b-versatile` đã bị gỡ 08/2026) — cần đổi model thì đổi env/`getGroqModel`, đừng hardcode lại trong từng route.
- `services/storageService.js` — upload ảnh/audio lên Cloudinary nếu có credentials, **fallback êm** về `backend/uploads/` khi không có (dev/test luôn chạy được). `lib/imageResize.js` (sharp) sinh thumbnail WebP.
- `lib/sanitizeHtml.js` — làm sạch HTML từ RichTextEditor trước khi lưu (frontend có `utils/sanitizeHtml.js` + DOMPurify khi render).

### Caching (3 tầng backend, dễ quên invalidate)
1. `lib/swrCache.js` — stale-while-revalidate in-memory dùng chung: fresh → trả ngay; stale → trả data cũ + revalidate nền; cold → gộp promise chống stampede. Có `invalidate(key)`.
2. `utils/cache.js` — `node-cache` (stdTTL 10′) cho Cambridge list / full-test / exam detail; `del()` ở đây cũng gọi `invalidateSwr`.
3. `lib/publicContent.js` — `getPracticeListCached` / `getSampleListCached` / `getFullTestsCached`, dùng chung cache key giữa endpoint lẻ và endpoint gộp `GET /api/home` (Home.jsx trước đây bắn 5 request, nay 1).

Frontend có tầng thứ tư: TanStack Query (`src/lib/queryClient.js`, staleTime 5′, gcTime 30′, không refetch on focus). **Sửa nội dung ở admin phải invalidate cả cache backend lẫn query cache** — xem `Admin.jsx#handleExamsChanged` và `adminService.notifyTrashChanged()`.

### Frontend
- `src/App.jsx` — toàn bộ route + `PrivateRoute` / `AdminRoute` / `StaffRoute`. Admin dùng một route cha `AdminLayout` với `<Outlet/>`; guard đặt ở **từng route con** (quyền không đồng nhất) — đừng gộp lên route cha. `/login` và `/register` chỉ redirect về `/` kèm `state.authModal` (đăng nhập bằng modal, không có trang riêng).
- `src/utils/axios.js` — axios instance, tự gắn Bearer token. Interceptor 401 xóa localStorage + redirect `/`, **trừ** endpoint auth và `/admin/settings` (tránh đá người dùng ra khi request nền lỗi).
- `src/services/*.js` — `examService`, `practiceService`, `sampleService`, `adminService`, `statsService`, `userService`, `chatbotService`, `draftService`. (Không có `authService` — auth nằm trong `context/AuthContext.jsx`.)
- Context: `AuthContext` (user/token/role trong localStorage), `ToastContext`, `FormDirtyContext` (chặn rời trang khi form dirty), `ProgressBarContext`.
- `src/services/draftService.js` — draft bài làm lưu **localStorage**, key `ielts_draft_{userId}_{examId}_{skillType}`, TTL 7 ngày, `purgeExpiredDrafts()` chạy 1 lần/phiên trong `App.jsx`. Payload khác nhau theo kỹ năng (map answer / `{essays, submittedTaskIds}` / `{transcripts, submittedPartIds}`).
- Question editors đã hợp nhất về **một nguồn chuẩn duy nhất**: `src/components/admin/editors/`. Đừng tạo lại bản song song trong `components/practice/` (bản fork cũ đã bị xóa).
- `index.css` có global rule không nằm trong layer → âm thầm đè utility của Tailwind v4. Style không ăn thì kiểm tra file này trước khi nghi ngờ class.

### Auth
Register/login (bcryptjs 10 rounds) hoặc Google OAuth (`@react-oauth/google` + `google-auth-library`, verify `audience` bằng `GOOGLE_CLIENT_ID`) → JWT 7 ngày trong localStorage → interceptor gắn header → 401 clear + redirect.

### Scoring
- Reading/Listening: bảng tra cố định trong `scoreUtils.js`.
- Writing/Speaking: submit → chấm **nền** bằng Groq (4 tiêu chí) → frontend poll `GET /answers/:id/status`; điểm từng tiêu chí ghi vào `WritingCriterionLog` / `SpeakingCriterionLog` (nguồn cho biểu đồ xu hướng ở Progress Analysis).
- Speaking: thu âm bằng Web Speech API, fallback Groq Whisper cho trình duyệt không hỗ trợ (stream trực tiếp từ Cloudinary URL nếu file ở cloud).
- Full Test: trung bình 4 band, làm tròn theo `ieltsOverall`; kết quả chỉ mở khi đủ 4 kỹ năng.

### `PUT /admin/exams/:id` — diff-based upsert
Không tái sinh ID nữa. `routes/admin/exams/core.js` + `reading.js`/`listening.js` diff trong `$transaction`: giữ ID `Passage`/`ListeningSection` (match `id` hoặc `number`), `QuestionGroup` (`id` hoặc `sortOrder`), `Question` (`id`, fallback `number`); update in-place, chỉ create/delete phần thực sự đổi. Nếu câu bị xóa đã có `QuestionAnswer`/`AnswerLog` → trả **409** kèm danh sách câu bị chặn. Frontend `ReadingTab`/`ListeningTab` phải giữ nguyên `id` trong `loadForEdit` và gửi kèm trong payload PUT — nếu không, diff hỏng.

### Auto-renumber câu hỏi token-based
`recalcAllGroupNumbers` / `recalcGroups` (`utils/practiceConfig.js`) quét token `[Q:n]` trong `noteSections` theo thứ tự xuất hiện, rewrite một lượt qua regex replacer (chống va chạm số), rồi cập nhật `Question.number` tương ứng — giữ nguyên `id`. Phải luôn khớp với khoảng `[qNumberStart, qNumberEnd]` mà backend dùng khi chấm và dựng breakdown.

## Environment variables

**Backend** (`backend/.env` — bị chặn ghi/sửa bởi settings.json):
```
DATABASE_URL=postgresql://...        # bắt buộc (Supabase, dùng chung local/prod)
DIRECT_URL=postgresql://...          # Prisma directUrl (migration qua connection trực tiếp)
JWT_SECRET=<random 32+>              # bắt buộc
GROQ_API_KEY=gsk_...                 # bắt buộc — writing/speaking/chatbot/whisper
GROQ_MODEL=openai/gpt-oss-120b       # optional, override model text
GOOGLE_CLIENT_ID=...                 # cần cho Google login (lazy init → thiếu thì lỗi lúc runtime, không lỗi lúc boot)
FRONTEND_URL=https://hzuy.net        # optional ở local, BẮT BUỘC ở prod (CORS allowlist)
PORT=3001                            # optional (docker set 5001)
CLOUDINARY_URL=...                   # optional — thiếu thì fallback lưu local uploads/
CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET   # thay thế cho CLOUDINARY_URL
RATE_LIMIT_WINDOW_MINUTES / RATE_LIMIT_SUBMIT_OBJECTIVE_MAX / RATE_LIMIT_SUBMIT_AI_MAX  # optional
ENABLE_RATE_LIMIT_IN_TEST=true       # optional, bật rate limit trong test
```

**Frontend** — `frontend/.env` (dev) và `frontend/.env.production` (build). Cả hai biến đều **build-time**, sửa xong phải build lại:
```
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=...
```

## Testing

- Backend: Vitest `environment: node`, test nằm cạnh source (`routes/*.test.js`, `lib/*.test.js`, `middleware/*.test.js`, `validators/*.test.js`, `services/*.test.js`), dùng supertest trên `module.exports = app` của `server.js`.
- Frontend: Vitest + jsdom + Testing Library, `src/setupTests.js` mock sẵn `window.alert`.
- CI (`.github/workflows/test.yml`) chạy cả hai suite trên push/PR vào `main` — **không tự deploy**.

## Deployment

Xem `DEPLOY.md` cho quy trình đầy đủ. Tóm tắt: backend chạy Docker trên `lab46`, bind `127.0.0.1:5001`, Nginx reverse-proxy `/api` + `/uploads`; frontend **build ở local** (server không có Node) rồi copy sang `/var/www/hzuy` — sau khi copy **bắt buộc** `sudo restorecon -Rv` thư mục dist, nếu không SELinux trả 403. Domain qua Cloudflare proxy nên không SSH được qua `hzuy.net`, phải SSH thẳng `lab46`.

## Project status

### Ổn định
Reading, Listening, Writing, Speaking, Full Test, Practice (đề lẻ), Samples, Series & leaderboard, Stats/Progress Analysis (+ AI Advisor `POST /stats/advice`, 5 lượt/user/ngày), Chatbot (20 msg/user/giờ, có chống prompt-injection, cap 6 message), Admin panel (CRUD 4 kỹ năng + samples + users, soft-delete/Trash, upload ảnh & audio), Auth + profile + streak, Cloudinary storage, rate limiting endpoint nộp bài.

Đã xử lý xong, không cần mở lại: BUG-06/07/08/09/10/13/14/15/21/26/28, diff-based upsert cho `PUT /admin/exams/:id`, hợp nhất question editors, auto-renumber token-based, port validate/error-banner/a11y từ `ListeningTab` sang `ReadingTab`, đồng bộ cache khi xóa cuốn ở `CambridgeTab`. Pipeline import PDF Cambridge đã bị gỡ bỏ (không dùng, sinh câu hỏi phẳng mà editor group-based không round-trip được).

### Còn gap — cần audit riêng
- **BUG-19 — Analytics** (`pages/admin/Analytics.jsx:12`, `pages/admin/Dashboard.jsx:255`): bar-chart dùng chung mới nối một phần vào nhánh dữ liệu teacher-only; link "teacher charts" ở Dashboard tồn tại nhưng chưa rõ phủ hết nội dung.
- **Auto-purge Trash không phải cron thật**: IIFE fire-and-forget bên trong `GET /admin/trash` mới hard-delete item quá 30 ngày — chỉ chạy khi có người mở trang Thùng rác.
- Chưa có email verification / password reset.
- Không có TLS trong app (do reverse proxy đảm nhiệm).
