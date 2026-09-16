# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> `AGENTS.md` (root) mô tả quy trình skill bắt buộc theo giai đoạn (plan → cook → test + security → git/ship → deploy). Đọc file đó trước khi bắt đầu một feature lớn.
> `DEPLOY.md` là runbook deploy production thủ công (server `lab46`, Nginx + Docker + Cloudflare).

## Commands

Không có root `package.json`/workspace — đây là hai project riêng, luôn `cd backend` hoặc `cd frontend` trước khi chạy lệnh. Backend không có ESLint (`npm run lint` chỉ tồn tại ở frontend).

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
⚠️ `backend/.env` (dùng bởi các lệnh trên, và bởi `npm run dev`/`npm start`/`npm test` mặc định) **vẫn trỏ chung một Supabase DB với production** — điều này KHÔNG đổi. Migration/seed chạy bằng các lệnh trên là chạy thẳng vào DB prod. Kiểm tra kỹ trước khi `migrate dev` / `migrate deploy` / chạy `seed-demo-data.js`. `npx prisma migrate reset` bị chặn trong `.claude/settings.json` — đúng như vậy, đừng tìm cách lách.

#### DB dev/test local (postgres-dev, khuyến nghị cho test tích hợp)

Để không phải chạm DB production khi viết/chạy test tích hợp (đặc biệt route đụng dữ liệu tài khoản thật hoặc thao tác xóa — vd `users`, `trash`), có sẵn 1 Postgres riêng chạy qua Docker, hoàn toàn tách khỏi Supabase:

```bash
docker compose up -d postgres-dev        # lần đầu: pull image + tạo volume postgres_dev_data
cd backend
npm run db:dev:push                      # đồng bộ schema.prisma → DB dev (xem lý do dùng db push, không phải migrate deploy, bên dưới)
npm run db:dev:seed                      # seed vài tài khoản user/teacher/admin + 2 đề thi giả + vài lượt thi
npm run test:dev-db                      # chạy toàn bộ test suite trỏ vào DB dev (đã xác nhận pass 277/277)
npm run db:dev:studio                    # Prisma Studio trỏ DB dev
npm run db:dev:seed -- --cleanup         # xoá dữ liệu seed (giữ schema)
```

**Tạo file `backend/docker-dev.env` (bắt buộc, không có sẵn khi mới clone repo — gitignored):** đây là điều kiện tiên quyết cho toàn bộ lệnh `db:dev:*`/`test:dev-db` ở trên. Tạo file `backend/docker-dev.env` với đúng nội dung sau (khớp credentials mặc định của service `postgres-dev` trong `docker-compose.yml` — chỉ đổi nếu bạn tự set `POSTGRES_DEV_USER`/`POSTGRES_DEV_PASSWORD`/`POSTGRES_DEV_DB` khác mặc định):

```env
DATABASE_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
DIRECT_URL="postgresql://ielts_dev:ielts_dev_local_only@127.0.0.1:5433/ielts_app_dev"
```

Thiếu file này hoặc `DATABASE_URL` bên trong không trỏ đúng `127.0.0.1:5433`, `backend/scripts/with-dev-db.js` sẽ báo lỗi rõ ràng và dừng ngay (không chạy lệnh thật) — không cần đoán.

Cách hoạt động: `backend/docker-dev.env` (gitignored, không phải `.env`/`.env.*` nên không bị chặn ghi/sửa) chứa `DATABASE_URL`/`DIRECT_URL` trỏ `127.0.0.1:5433` (service `postgres-dev`, cổng riêng khác `5432` mặc định để không đụng Postgres cài sẵn trên máy). `backend/scripts/with-dev-db.js` nạp file này (override) rồi mới spawn lệnh thật (`npx prisma ...`, `vitest run`) — nên các script `db:dev:*`/`test:dev-db` trong `package.json` không bao giờ đụng `backend/.env`. Muốn chạy lệnh khác với DB dev: `node scripts/with-dev-db.js -- <lệnh>`.

**Vì sao `db push` chứ không phải `migrate deploy`** *(lịch sử — xem "Lịch sử migration đã squash" bên dưới để biết trạng thái hiện tại)*: lịch sử migration từng có một chỗ mâu thuẫn — migration `20260320030649_rebuild_full_ielts` `DROP TABLE "Exam"`, nhưng bảng `Exam` chưa từng được tạo lại ở migration nào sau đó dù `schema.prisma` vẫn có `model Exam` (bảng chỉ tồn tại trên DB thật vì đã bị chỉnh tay ngoài lịch sử migration tại một thời điểm nào đó, không rõ khi nào). Replay `migrate deploy` từ đầu lên DB trắng từng dừng đúng ở migration kế tiếp, `20260321000000_remove_level_from_exam`, với lỗi Prisma `P3018` / Postgres `42P01`: `relation "Exam" does not exist`. Vấn đề này (và hai vấn đề tương tự ở `Series`/`SeriesExam`/`SeriesMapping`) **đã được giải quyết bằng squash baseline** — `migrate deploy` từ DB rỗng nay chạy sạch. `db push` không còn bắt buộc để dựng DB dev, nhưng script `db:dev:push`/hướng dẫn dưới đây vẫn giữ nguyên vì không nằm trong phạm vi lần squash này (đổi sang `migrate deploy` cho quy trình dựng DB dev là việc riêng, cần bàn trước) — vẫn đúng khi dùng, chỉ không còn là "phương án bắt buộc" nữa.

**Seed data** (`backend/prisma/seed-dev.js`) hoàn toàn giả, tự chặn nếu `DATABASE_URL` không trỏ `127.0.0.1:5433` (không thể lỡ chạy lên DB khác kể cả prod). Tài khoản: `dev-admin@example.test` / `dev-teacher@example.test` / `dev-user@example.test`, mật khẩu `Password123!`. Idempotent — chạy lại không tạo trùng.

Test suite hiện tại (351 test backend) đều mock `lib/prisma` ở tầng route/lib **trừ** `routes/userSoftDelete.test.js` (integration test thật trên `postgres-dev`) — nên `npm test` thường (không qua `postgres-dev`) vẫn an toàn với DB hiện tại. `postgres-dev` có giá trị chính cho: test tích hợp thật (soft-delete `users`, sẽ mở rộng dần sang audit log/`trash`), và cho việc chạy `npx prisma migrate dev`/thử migration mới mà không đụng DB thật. Lưu ý: `routes/userSoftDelete.test.js` có 2 assertion đếm tổng số user (`totalActive`/`totalUsers`) không isolate với các test file khác chạy song song trên cùng `postgres-dev` — chạy `test:dev-db` mặc định (vitest chạy file song song) có thể fail giả (flaky) 1-2 test ở đúng file này; chạy `npx vitest run --no-file-parallelism` (qua `with-dev-db.js`) để xác nhận thật sự pass hết. Đây là vấn đề cô lập test có sẵn từ trước, không liên quan migration.

### Lịch sử migration đã squash (2026-09-16)

Lịch sử migration gốc (~18 migration, từ `20260319163126_init`) không thể `prisma migrate deploy` từ DB rỗng: nhiều bảng (`Exam`, `Series`, `SeriesExam`, `SeriesMapping`) bị `ALTER`/`DROP` bởi một migration mà chưa từng có `CREATE TABLE` tương ứng ở bất kỳ migration nào trước đó — các bảng này rõ ràng đã được tạo thẳng trên production ngoài migration history (thủ công hoặc `db push`) tại thời điểm không xác định. Đã squash toàn bộ 14 migration đầu (`20260319163126_init` → `20260827000000_remove_series_seriesexam_seriesmapping`) thành một baseline duy nhất, `20260827000001_baseline_init_through_series_removal`, sinh bằng `prisma migrate diff --from-empty --to-url <production DIRECT_URL>` (introspect production thật, chỉ đọc) rồi trừ đi phần do các migration sau đó (`20260827120000_add_attempt_score_index` trở đi) tạo/sửa — xem comment đầu file baseline để biết chi tiết từng migration bị gộp/loại. Các migration từ `20260827120000_add_attempt_score_index` trở đi giữ nguyên, không đụng.

Đã xác nhận trên `postgres-dev`: `migrate deploy` từ schema rỗng chạy hết baseline + các migration còn lại không lỗi; `prisma migrate diff` so với `schema.prisma` và so với production hiện tại đều ra 0 khác biệt; `migrate status` sạch; seed + toàn bộ 351 test pass (xem lưu ý flaky ở trên). Chưa áp dụng thay đổi này lên production — production tự nó đã ở đúng state cuối cùng nên không cần chạy gì thêm, chỉ lịch sử migration file cục bộ được rút gọn.

### Docker
```bash
docker compose up -d --build backend   # CHỈ service backend
docker compose up -d postgres-dev      # DB dev/test local — xem mục "DB dev/test local" ở trên
```
`docker-compose.yml` có 3 service: `backend`, `postgres-dev` (DB dev/test local, xem mục Database ở trên), và `postgres-prod` **chưa active** (chuẩn bị cho migration khỏi Supabase, xem `docs/deploy/self-hosted-postgres-migration.md` — mục đích khác hẳn `postgres-dev`, đừng nhầm hai service này). Đừng `docker compose up` trần — sẽ dựng thêm cả `postgres-prod` rỗng ngoài ý muốn.

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
- `PUT /admin/users/:id/toggle-lock` (`routes/admin/users.js`) là API **toggle một chiều** (`isLocked: !user.isLocked`), không nhận trạng thái đích mong muốn — gọi 2 lần liên tiếp sẽ trả tài khoản về trạng thái ban đầu (khoá rồi lại mở khoá) thay vì báo lỗi/no-op. Route tự thân không có idempotency key hay kiểm tra trạng thái mong muốn trong body; việc chống double-submit hiện chỉ nằm ở tầng giao diện (`Accounts.jsx`/`Users.jsx` disable nút xác nhận + nút hàng khi `lockMutation.isPending`). Nếu sau này có client khác (mobile app, script nội bộ, Postman collection) gọi thẳng endpoint này mà không qua UI hiện tại, cần xem lại — cân nhắc đổi sang API nhận trạng thái đích tường minh (`PUT .../lock` body `{ isLocked: true|false }`) hoặc thêm optimistic-concurrency check.

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
- Question editors cấp group (MCQ, Matching, Note/Table Completion...) đã hợp nhất về một nguồn chuẩn: `src/components/admin/editors/` (dùng cho Exam, ví dụ `ReadingGroupEditor.jsx`). **`components/practice/` không phải code chết** — nó chứa các sub-editor theo loại câu hỏi (`TrueFalseEditor`, `MatchingHeadingsEditor`, `DiagramLabelEditor`, `SummaryCompletionEditor`/`...Simple`) được cả `admin/editors/ReadingGroupEditor.jsx` **lẫn** `admin/PracticeGroupCard.jsx` (editor của PracticeExam, dùng bởi `pages/admin/{ReadingPractice,ListeningPractice}.jsx`) cùng import — đây là tầng dùng chung giữa hai hệ Exam/PracticeExam, đừng nhân bản hay xóa nhầm. Thứ đã bị xóa trước đây là một bộ editor cấp group riêng cho Practice (song song với `admin/editors/`), không phải toàn bộ thư mục `components/practice/`.
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

### Retention — tự động dọn dữ liệu cũ (không phải cron thật)
Cả hai cơ chế dưới đây dùng chung 1 pattern: **kích hoạt theo request** (không phải job lập lịch độc lập — dự án chưa có scheduler nào), fire-and-forget (route không `await`, không làm chậm response), tự `try/catch` (lỗi dọn dẹp không được làm hỏng request), và chỉ ghi `AuditLog` khi thực sự xóa được gì.
- **Trash** (`routes/admin/trash.js`, IIFE trong `GET /admin/trash`): hard-delete item soft-delete quá **30 ngày**. Không có cơ chế chống chạy trùng — chấp nhận được vì `deleteMany` trên tập rỗng vốn rẻ.
- **AuditLog** (`lib/auditLogRetention.js`, gọi từ `GET /admin/audit-logs`): xóa bản ghi `AuditLog.createdAt` quá **365 ngày** (`AUDIT_LOG_RETENTION_DAYS` — đổi thời hạn thì sửa đúng hằng số này, không rải số cứng nơi khác). Khác Trash, có **chống chạy trùng**: lần dọn gần nhất lưu ở bảng `Setting` (key `audit_log_last_purge_at`, value là ISO timestamp), chỉ chạy lại sau tối thiểu **6 giờ** (`AUDIT_LOG_PURGE_MIN_INTERVAL_MS`) — giành quyền chạy bằng compare-and-swap trên `Setting.key` (unique) nên nhiều admin cùng mở trang Nhật ký hoạt động gần như đồng thời cũng chỉ 1 request thắng claim. Log việc dọn dùng action `auditlog.auto_purge`, `actorType: 'system'`, metadata `{ deletedCount, cutoff }`. AuditLog vẫn bất biến với người dùng — không có endpoint xóa thủ công qua UI.

### Quy ước timezone — ngày lịch Việt Nam
Người dùng hệ thống ở Việt Nam (UTC+7), nhưng `DateTime` trong DB (Postgres) và session Postgres đều là UTC, và TZ của tiến trình Node **khác nhau giữa các môi trường** (máy dev thường set `Asia/Saigon`, container production — `node:20-slim`, không set biến `TZ` — mặc định UTC). Code nào dùng hàm Date local (`new Date(y,m,d)`, `setHours`, `getFullYear/getMonth/getDate`...) để tính mốc "đầu ngày"/"cuối ngày" sẽ cho **kết quả khác nhau giữa dev và production** dù cùng một đoạn code; code dùng UTC tường minh (`T00:00:00.000Z`) thì đúng ở mọi môi trường nhưng lại lệch 7 tiếng so với ngày lịch thật của người dùng VN.

**Quy ước:** mọi mốc đầu/cuối **ngày lịch** (không phải khoảng tính lùi theo độ dài) dùng trong lọc/thống kê PHẢI tính theo giờ Việt Nam (UTC+7), neo **tường minh bằng epoch-millis arithmetic** — KHÔNG phụ thuộc `process.env.TZ` hay TZ hệ điều hành. Hàm dùng chung: `backend/lib/vnDate.js` (`vnStartOfDay`, `vnEndOfDay`, `vnStartOfToday`, `vnEndOfToday`, `vnStartOfMonth`, `vnCalendarParts`) — mọi route cần mốc ngày-lịch (Dashboard Overview "Hôm nay"/"Tháng này", `/admin/attempts` dateFrom/dateTo, `/admin/audit-logs` from/to, Analytics preset "today"/custom range) đều import từ đây thay vì tự tính. Streak ("hôm nay có làm bài không") ở `routes/user.js`/`routes/chatbot.js` dùng chung `backend/lib/streak.js` (`computeStreak`), cũng neo theo ngày lịch VN qua `vnDate.js`.

**Ngoại lệ — KHÔNG áp dụng quy ước này:** các cơ chế retention ở mục trên (Trash 30 ngày, AuditLog 365 ngày) tính lùi theo **độ dài thời gian** từ `Date.now()` (`Date.now() - N*ms`), không phải ranh giới ngày lịch — timezone-agnostic theo đúng thiết kế, giữ nguyên cách tính cũ, không chuyển sang `vnDate.js`.

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

## Redesign giao diện người dùng (4 đợt) — ĐÃ HOÀN TẤT (chưa deploy)

Đã thiết kế lại giao diện phía người dùng theo hướng "nền ấm áp học thuật": năng lượng/chuyển động chỉ dành cho trang chủ, kết quả và tiến độ; vùng làm bài thi (4 màn hình `ReadingExam.jsx`/`ListeningExam.jsx`/`WritingExam.jsx`/`SpeakingExam.jsx` + toàn bộ component render câu hỏi dùng chung với chúng, kể cả `PracticeExamPage.jsx`) giữ nguyên tối giản tuyệt đối, không chạm tới. Giao diện admin cũng không đụng — đây là nguyên tắc lâu dài, không chỉ áp dụng trong lúc redesign.

**Bảng màu đã chọn** (khai báo trong `frontend/src/index.css`, đăng ký lại vào `@theme` thành Tailwind utility `bg-*`/`text-*`/`border-*`):
- Màu nhấn thương hiệu: tím `#5b21b6` (hover `#4c1d95`, nền nhạt `#ede9fe`) — **chỉ** dùng cho hành động chính, thanh tiến độ, khu vực điểm số, chuỗi ngày luyện tập. Không lan ra toàn bộ giao diện.
- Nền ấm chung: `#fdfbf5` thay trắng thuần (`--bg`); card vẫn nền trắng (`--surface`) để nổi trên nền ấm.
- 4 màu kỹ năng — dùng cho chip nhãn/biểu đồ/viền thẻ: Reading `#2563eb` (blue), Listening `#0e7490` (cyan đậm — cố tình lệch tông so với màu nhấn để không trùng), Writing `#c2410c` (orange), Speaking `#be185d` (pink). Mỗi màu có bộ 3 token `--skill-*-color/-bg/-border`.
- Token ngữ nghĩa `--success`/`--error`/`--warning`/`--info` đều có đủ biến thể `-bg/-border/-text` — nguồn duy nhất cho đúng/sai/cảnh báo/thông tin trên toàn app, thay cho việc trước đây mỗi trang tự chọn green/emerald, red/rose/slate khác nhau.
- Giao diện admin **giữ nguyên zinc đơn sắc**: `.admin-scope` tự khai báo lại `--primary`/`--color-primary` về zinc trong `index.css`, không bị ảnh hưởng khi đổi token toàn app.

**Tiến độ theo đợt:**
- ✅ **Đợt 1** (2 pha): khảo sát + áp bảng màu token, gộp màu ngữ nghĩa/trung tính, áp màu nhấn/màu kỹ năng đúng phạm vi, sửa vài lệch nhỏ (thẻ h1 thiếu ở `PracticeList.jsx`/`SeriesPage.jsx`, bo góc skeleton lệch ở `ProgressAnalysis.jsx`), giảm giọng thương mại điện tử ("Sắp có bài" ribbon → tag "Đang cập nhật", "Gợi ý cho bạn" → "Đề thi liên quan" ở `FullTestDetail.jsx`). Commit tách theo nhóm việc trên `main`, chưa deploy.
- ✅ **Đợt 2** (5 commit riêng trên `main`, chưa deploy): component dùng chung `components/common/{Card,PageHeader,StatValue}.jsx`, thay thế ở các chỗ khớp diện mạo hiện tại (bỏ qua 2 lệch chuẩn có sẵn — ô rỗng thiếu shadow ở `SeriesPage.jsx`, `rounded-xl` ở `InlinePreviewPanel.jsx` — không tự sửa); thống nhất cỡ chữ điểm số/streak (streak trang chủ 2xl→3xl, vòng band `SkillResult` 3xl→4xl, giữ nguyên chế độ luyện tập vì vòng cố định 88px dễ tràn); hook `hooks/useCountUp.js` (rAF, tôn trọng `prefers-reduced-motion`) đếm số tăng dần cho band score ở `SkillResult.jsx`/`FullTestResult.jsx`; bổ sung `.anim-fade-up` cho `SeriesPage`/`ProgressAnalysis`/`FullTestResult`/`UserProfile`; nâng loading/error/empty ở `SampleDetailPage.jsx` (thêm state lỗi thật, trước đây catch âm thầm `navigate(-1)`), `FullTestDetail.jsx` (thêm nút Thử lại, tách `fetchBookData`) và ô rỗng ở `ProgressAnalysis.jsx` lên khung xương/icon+tiêu đề. Test qua trình duyệt thật (Playwright, không cần đăng nhập): Home, `FullTestDetail`, `SampleDetailPage`, `WritingSamplesPage`, `SpeakingSamplesPage` — kể cả trạng thái loading giả lập delay API. Các trang cần đăng nhập (`SeriesPage`, `ProgressAnalysis`, `UserProfile`, `FullTestResult`, `PracticeList`, `FullTest`) chỉ xác minh qua đọc code + test tự động (419 test frontend pass), chưa test qua trình duyệt thật vì môi trường dev trỏ chung DB Supabase với production, không tự ý tạo/dùng tài khoản thật để đăng nhập.
- ✅ **Đợt 3** (5 việc, mỗi việc 1 commit riêng trên `main`, chưa deploy): tạo `components/UserLayout.jsx` — route cha `<Navbar/><Outlet/>` (mirror `AdminLayout.jsx`) thay cho 14 trang tự import/render `<Navbar/>` riêng lẻ; `PracticeExamPage.jsx` (màn hình làm bài luyện tập) cố tình không bọc layout này. Gộp `WritingSamplesPage.jsx`/`SpeakingSamplesPage.jsx` (giống nhau ~88%) thành `pages/SamplesPage.jsx` nhận prop `skill`, lấy options/label theo level từ `contentCardConfig.js` thay vì khai riêng, nhân tiện sửa subtitle Writing dùng chung lookup map an toàn như Speaking (trước đây ternary cứng chỉ đúng 2 giá trị). Thiết kế lại `ContentCard.jsx`: bỏ nút CTA full-width giả (trước đây `action.decorative` vẫn hiện nút nhưng `pointer-events:none`), thay bằng mũi tên tròn nhỏ góc dưới-phải khi khả dụng hoặc pill "Đang cập nhật" khi `action.disabled`; showcase hover (lift/border/shadow) giờ chỉ áp dụng khi card thật sự `clickable` (có `onClick`). Thay 2 carousel cuộn ngang (`SeriesRow` ở `FullTest.jsx` — kéo chuột + scroll-snap; `CompactBookTrack` ở `Home.jsx` — nút mũi tên tròn nổi bóng) bằng lưới co giãn: `FullTest.jsx` (trang liệt kê đầy đủ) dùng grid wrap không cap; `Home.jsx` (trang tóm tắt) cap 6 cuốn, tận dụng link "Xem trọn bộ..." có sẵn làm "Xem tất cả". Bố trí lại `Home.jsx`: bỏ layout 2 cột 8/4, dải "Tiến độ của bạn" full-width (resume/CTA + 3 widget streak/band/lối-tắt hàng ngang) lên ngay dưới hero; gộp 2 section giới thiệu tính năng thành 1 lưới 4 ô "Khám phá thêm". Test qua Playwright (không phải Chrome extension — không kết nối được phiên này) với tài khoản `dev-user@example.test` trên `postgres-dev` ở 3 kích thước màn hình cho các việc chạm bố cục; 419 test frontend + lint đều sạch sau mỗi việc. Phát hiện ngoài phạm vi, không tự sửa: Navbar tràn ngang đúng breakpoint 768px (`md`) trên mọi trang — lỗi có sẵn từ trước, không liên quan các thay đổi Đợt 3.
- ✅ **Đợt 4** (5 việc đánh bóng/phát sinh, mỗi việc 1 commit riêng trên `main`, chưa deploy — đợt cuối, hoàn tất cả 4/4 đợt): sửa `Navbar.jsx` tràn ngang — đo bằng Playwright quét liên tục 320-1920px thì thấy header (logo + menu + khối tài khoản, `flex-nowrap` không co giãn) cần ~1178-1195px mới đủ chỗ, trong khi breakpoint chuyển sang menu desktop lại đặt ở `md` (768px) → tràn suốt dải ~768-1195px; đổi 5 chỗ `md:`/`hidden md:flex` sang `xl:` (1280px, đủ dư), không đổi cấu trúc nav. Làm phong phú `NotFound.jsx`: minh họa SVG nội tuyến (trang giấy + kính lúp, không tải ảnh ngoài), thông điệp tiếng Việt bối cảnh học tập, 3 thẻ lối đi gợi ý (Luyện đề thi/Thư viện bài mẫu/Tiến độ học tập) dùng `Card` sẵn có. Bỏ `sort(() => 0.5 - Math.random())` ở khối "Đề thi liên quan" (`FullTestDetail.jsx`) — thay bằng tiêu chí có chủ đích, ổn định giữa các lần tải: ưu tiên cùng bộ sách, rồi số thứ tự cuốn gần nhất; tiêu chí "chưa làm" không dùng được vì `GET /api/admin/full-tests` không trả trạng thái đã làm/chưa làm (không sửa backend). Thêm nhịp thưởng ngắn `.anim-score-pop` (index.css — 0.5s, trễ 0.7s khớp lúc `useCountUp` ~0.9s đếm xong, chỉ transform+opacity, không lặp, tôn trọng `prefers-reduced-motion`) cho dấu tích ở `SkillResult.jsx` và huy hiệu "Đủ 4 kỹ năng" ở `FullTestResult.jsx`; nhân tiện phát hiện và sửa (đã hỏi & được xác nhận) bug có sẵn ở `FullTestResult.jsx`: 3 thẻ Bento thiếu hẳn class `lg:col-span-4/5/3` dù comment mô tả đúng ý định, khiến co lại ~87px/thẻ ở màn hình rộng. Dọn 2 lệch chuẩn treo từ Đợt 2: ô rỗng ở `SeriesPage.jsx` đổi `variant="flat"` → mặc định để có `shadow-xs` giống ô lỗi cùng trang; còn `InlinePreviewPanel.jsx` (rounded-xl) xác minh lại thì phát hiện chỉ dùng trong 4 file admin (`ReadingTab`/`ListeningTab`/`WritingTab`/`SpeakingTab`) — giữ nguyên, không sửa, vì mâu thuẫn với nguyên tắc "không đụng giao diện admin". Test: lint + 419 test frontend sạch sau mỗi việc; trình duyệt thật qua Playwright (Chrome extension không kết nối được phiên này, như Đợt 3) với `dev-user@example.test` trên `postgres-dev`; trang `/full-test/result` không có dữ liệu isComplete thật trong seed hiện tại (seed chỉ có 1 book, `seriesId` null khiến API 500) nên phần "Đủ 4 kỹ năng" chỉ xác minh bằng cách giả lập response API qua `page.route` của Playwright, không phải dữ liệu thật end-to-end.

**Tồn đọng sau khi hoàn tất 4 đợt** (không nằm trong phạm vi đã làm, cần bàn riêng nếu muốn xử lý tiếp): `InlinePreviewPanel.jsx` vẫn dùng `rounded-xl` thay vì `rounded-2xl` chuẩn chung — nằm trong giao diện admin nên cố tình để nguyên; seed data `postgres-dev` hiện chỉ có 1 book với `seriesId: null`, không đủ để test end-to-end trang `/full-test/result` hay kiểm chứng trực quan tiêu chí sắp xếp "Đề thi liên quan" với nhiều bộ sách thật.

## Project status

### Ổn định
Reading, Listening, Writing, Speaking, Full Test, Practice (đề lẻ), Samples, Series & leaderboard, Stats/Progress Analysis (+ AI Advisor `POST /stats/advice`, 5 lượt/user/ngày), Chatbot (20 msg/user/giờ, có chống prompt-injection, cap 6 message), Admin panel (CRUD 4 kỹ năng + samples + users, soft-delete/Trash, upload ảnh & audio), Auth + profile + streak, Cloudinary storage, rate limiting endpoint nộp bài.

Đã xử lý xong, không cần mở lại: BUG-06/07/08/09/10/13/14/15/21/26/28, diff-based upsert cho `PUT /admin/exams/:id`, hợp nhất question editors, auto-renumber token-based, port validate/error-banner/a11y từ `ListeningTab` sang `ReadingTab`, đồng bộ cache khi xóa cuốn ở `CambridgeTab`. Pipeline import PDF Cambridge đã bị gỡ bỏ (không dùng, sinh câu hỏi phẳng mà editor group-based không round-trip được).

### Còn gap — cần audit riêng
- **BUG-19 — Analytics** (`pages/admin/Analytics.jsx:12`, `pages/admin/Dashboard.jsx:255`): bar-chart dùng chung mới nối một phần vào nhánh dữ liệu teacher-only; link "teacher charts" ở Dashboard tồn tại nhưng chưa rõ phủ hết nội dung.
- **Auto-purge Trash không phải cron thật**: IIFE fire-and-forget bên trong `GET /admin/trash` mới hard-delete item quá 30 ngày — chỉ chạy khi có người mở trang Thùng rác.
- Chưa có email verification / password reset.
- Không có TLS trong app (do reverse proxy đảm nhiệm).
