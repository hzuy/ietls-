-- Baseline migration thay thế các migration #1-14 (từ 20260319163126_init tới
-- 20260827000000_remove_series_seriesexam_seriesmapping). Ranh giới này mở rộng
-- lần thứ ba từ baseline gốc (#1-7 -> #1-11 -> #1-13 -> #1-14) vì phát hiện thêm
-- một trường hợp giống hệt bug "Exam"/"Series" ở chính #14:
--
-- Migration #14 (remove_series_seriesexam_seriesmapping) có:
--   ALTER TABLE "SeriesExam" DROP CONSTRAINT IF EXISTS ...
--   ALTER TABLE "SeriesMapping" DROP CONSTRAINT IF EXISTS ...
--   DROP TABLE IF EXISTS "SeriesMapping"/"SeriesExam"/"Series"
-- `IF EXISTS` chỉ áp dụng cho constraint/index/table ở vế đó, nhưng bản thân
-- `ALTER TABLE "SeriesExam" ...` và `ALTER TABLE "SeriesMapping" ...` vẫn cần
-- bảng tồn tại để ALTER được — và như "Series" (đã xử lý khi gộp #13), không
-- migration nào trong toàn bộ lịch sử gốc (#1-18, đã kiểm tra bằng
-- `git log --all -p`) từng `CREATE TABLE "SeriesExam"` hay `CREATE TABLE
-- "SeriesMapping"`. Cả ba bảng Series/SeriesExam/SeriesMapping đều phải được
-- tạo thẳng trên production ngoài migration history (thủ công / `db push`)
-- rồi bị xóa nguyên cụm ở #14 — replay từ DB rỗng luôn lỗi tại #14 với
-- `relation "SeriesExam" does not exist` sau khi đã gộp #13.
--
-- Vì #14 CHỈ DROP (không CREATE/ALTER thêm gì khác), gộp #14 vào baseline
-- không làm thay đổi bất kỳ CREATE TABLE/INDEX/FK nào so với baseline #1-13 —
-- baseline vốn đã không chứa Series/SeriesExam/SeriesMapping (vì các bảng này
-- không tồn tại trong production hiện tại, đã bị #14 xóa), nên phần schema
-- payload bên dưới giữ nguyên y hệt bản #1-13, chỉ đổi ranh giới/comment.
--
-- Cách sinh (giống các lần squash trước, chỉ đổi ranh giới):
-- 1. Introspect trực tiếp production (chỉ đọc, `prisma migrate diff --from-empty
--    --to-url <production DIRECT_URL> --script`) để lấy đúng state thật của
--    production tại thời điểm squash.
-- 2. Trừ đi phần do migration #15 trở đi (add_attempt_score_index ...
--    add_user_deleted_at) đã tạo/sửa — các migration đó được giữ nguyên, không
--    gộp vào baseline này, nên baseline chỉ chứa đúng phần state tương đương
--    "ngay trước #15".
--
-- Bảng/cột/index/FK bị loại khỏi baseline vì do #15 trở đi tạo/sửa:
--   - Attempt_score_idx (#15, add_attempt_score_index)
--   - User.googleId + User_googleId_key (#16, add_google_oauth_fields)
--   - AuditLog + FK/index liên quan (#17, add_audit_log)
--   - User.deletedAt (#18, add_user_deleted_at)
-- User.password được giữ NOT NULL (đúng state trước #16, migration #16 mới DROP NOT NULL).
--
-- Baseline này giữ nguyên phần do #8-14 tạo/sửa (không loại):
--   - Setting + User.isLocked (#8, add_user_lock_settings)
--   - Các index hiệu năng ở #9 (add_performance_indexes)
--   - AnswerLog + FK/index liên quan (#10, add_answer_log) — FK AnswerLog_attemptId_fkey
--     giữ đúng ON DELETE SET NULL theo dump thật
--   - #11 (add_answer_log_question_fk) không thêm gì mới ngoài phần #10 đã có
--   - WritingCriterionLog, SpeakingCriterionLog + FK/index liên quan (#12, add_criterion_logs)
--   - ExamSeries_deletedAt_idx, BookCover_deletedAt_idx, BookCover_seriesId_idx (#13,
--     add_deletedAt_indexes — trừ statement Series_deletedAt_idx vì bảng "Series"
--     không có CREATE TABLE hợp lệ trong lịch sử, xem giải thích ở trên)
--   - #14 (remove_series_seriesexam_seriesmapping) không có gì để giữ — toàn bộ
--     là DROP các bảng vốn đã không thuộc baseline

-- CreateTable
CREATE TABLE "AnswerLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "attemptId" INTEGER,
    "questionId" INTEGER NOT NULL,
    "skillType" TEXT NOT NULL,
    "questionType" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "examId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "aiFeedback" TEXT,
    "answers" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCover" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "bookNumber" INTEGER NOT NULL,
    "coverImageUrl" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BookCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookNumber" INTEGER,
    "testNumber" INTEGER,
    "coverImageUrl" TEXT,
    "seriesId" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSeries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningSection" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "context" TEXT NOT NULL,
    "audioUrl" TEXT,
    "transcript" TEXT,

    CONSTRAINT "ListeningSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingOption" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "optionLetter" TEXT NOT NULL,
    "optionText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteLine" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "contentWithTokens" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineType" TEXT NOT NULL DEFAULT 'content',

    CONSTRAINT "NoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteSection" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NoteSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "subtitle" TEXT,
    "letteredParagraphs" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeExam" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" TEXT,
    "thumbnailUrl" TEXT,
    "audioUrl" TEXT,
    "passage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isNormalized" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PracticeExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuestion" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT,
    "orderNum" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT,
    "correctAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "passageId" INTEGER,
    "listeningSectionId" INTEGER,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "imageUrl" TEXT,
    "groupId" INTEGER,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER,
    "qNumberStart" INTEGER NOT NULL DEFAULT 1,
    "qNumberEnd" INTEGER NOT NULL DEFAULT 1,
    "instruction" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "passageId" INTEGER,
    "canReuse" BOOLEAN NOT NULL DEFAULT false,
    "maxChoices" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "transcript" TEXT,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,

    CONSTRAINT "SpeakingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingCriterionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "speakingAnswerId" INTEGER NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingCriterionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingPart" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "cueCard" TEXT,

    CONSTRAINT "SpeakingPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingQuestion" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,

    CONSTRAINT "SpeakingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSample" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "thumbnailUrl" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "examType" TEXT,
    "content" TEXT,

    CONSTRAINT "SpeakingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSamplePart" (
    "id" SERIAL NOT NULL,
    "sampleId" INTEGER NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "SpeakingSamplePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSampleQuestion" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "orderNum" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,

    CONSTRAINT "SpeakingSampleQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Lưu ý: "password" giữ NOT NULL — đúng state trước migration #16
-- (20260905000000_add_google_oauth_fields), migration đó mới DROP NOT NULL.
-- Không có googleId (#16)/deletedAt (#18) — các cột này do migration #15 trở đi
-- thêm, không thuộc baseline này. "isLocked" (#8) được giữ vì thuộc baseline #1-14.
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "requirePasswordChange" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "essayText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,

    CONSTRAINT "WritingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingCriterionLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "writingAnswerId" INTEGER NOT NULL,
    "criterion" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingCriterionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingSample" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "thumbnailUrl" TEXT,
    "content" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "examType" TEXT,
    "taskType" TEXT,

    CONSTRAINT "WritingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingTask" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "taskType" TEXT,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "minWords" INTEGER NOT NULL,

    CONSTRAINT "WritingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerLog_attemptId_idx" ON "AnswerLog"("attemptId");

-- CreateIndex
CREATE INDEX "AnswerLog_questionId_idx" ON "AnswerLog"("questionId");

-- CreateIndex
CREATE INDEX "AnswerLog_userId_isCorrect_idx" ON "AnswerLog"("userId", "isCorrect");

-- CreateIndex
CREATE INDEX "AnswerLog_userId_skillType_questionType_idx" ON "AnswerLog"("userId", "skillType", "questionType");

-- CreateIndex
CREATE INDEX "Attempt_createdAt_idx" ON "Attempt"("createdAt");

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");

-- CreateIndex
CREATE INDEX "Attempt_examId_score_idx" ON "Attempt"("examId", "score");

-- CreateIndex
CREATE INDEX "Attempt_finishedAt_createdAt_idx" ON "Attempt"("finishedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_finishedAt_idx" ON "Attempt"("finishedAt");

-- CreateIndex
CREATE INDEX "Attempt_userId_examId_idx" ON "Attempt"("userId", "examId");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE INDEX "Attempt_userId_score_idx" ON "Attempt"("userId", "score");

-- CreateIndex
CREATE INDEX "BookCover_deletedAt_idx" ON "BookCover"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookCover_seriesId_bookNumber_key" ON "BookCover"("seriesId", "bookNumber");

-- CreateIndex
CREATE INDEX "BookCover_seriesId_idx" ON "BookCover"("seriesId");

-- CreateIndex
CREATE INDEX "Exam_createdAt_idx" ON "Exam"("createdAt");

-- CreateIndex
CREATE INDEX "Exam_seriesId_bookNumber_testNumber_idx" ON "Exam"("seriesId", "bookNumber", "testNumber");

-- CreateIndex
CREATE INDEX "Exam_skill_idx" ON "Exam"("skill");

-- CreateIndex
CREATE INDEX "ExamSeries_deletedAt_idx" ON "ExamSeries"("deletedAt");

-- CreateIndex
CREATE INDEX "PracticeExam_createdAt_idx" ON "PracticeExam"("createdAt");

-- CreateIndex
CREATE INDEX "PracticeExam_skill_idx" ON "PracticeExam"("skill");

-- CreateIndex
CREATE INDEX "Question_groupId_idx" ON "Question"("groupId");

-- CreateIndex
CREATE INDEX "Question_listeningSectionId_idx" ON "Question"("listeningSectionId");

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_attemptId_idx" ON "QuestionAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_questionId_idx" ON "QuestionAnswer"("questionId");

-- CreateIndex
CREATE INDEX "QuestionGroup_passageId_idx" ON "QuestionGroup"("passageId");

-- CreateIndex
CREATE INDEX "QuestionGroup_sectionId_idx" ON "QuestionGroup"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_createdAt_idx" ON "SpeakingAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_partId_idx" ON "SpeakingAnswer"("partId");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_userId_idx" ON "SpeakingAnswer"("userId");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_userId_partId_idx" ON "SpeakingAnswer"("userId", "partId");

-- CreateIndex
CREATE INDEX "SpeakingCriterionLog_speakingAnswerId_idx" ON "SpeakingCriterionLog"("speakingAnswerId");

-- CreateIndex
CREATE INDEX "SpeakingCriterionLog_userId_criterion_idx" ON "SpeakingCriterionLog"("userId", "criterion");

-- CreateIndex
CREATE INDEX "SpeakingSample_createdAt_idx" ON "SpeakingSample"("createdAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "WritingAnswer_createdAt_idx" ON "WritingAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "WritingAnswer_taskId_idx" ON "WritingAnswer"("taskId");

-- CreateIndex
CREATE INDEX "WritingAnswer_userId_idx" ON "WritingAnswer"("userId");

-- CreateIndex
CREATE INDEX "WritingAnswer_userId_taskId_idx" ON "WritingAnswer"("userId", "taskId");

-- CreateIndex
CREATE INDEX "WritingCriterionLog_userId_criterion_idx" ON "WritingCriterionLog"("userId", "criterion");

-- CreateIndex
CREATE INDEX "WritingCriterionLog_writingAnswerId_idx" ON "WritingCriterionLog"("writingAnswerId");

-- CreateIndex
CREATE INDEX "WritingSample_createdAt_idx" ON "WritingSample"("createdAt");

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCover" ADD CONSTRAINT "BookCover_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSection" ADD CONSTRAINT "ListeningSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingOption" ADD CONSTRAINT "MatchingOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLine" ADD CONSTRAINT "NoteLine_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "NoteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteSection" ADD CONSTRAINT "NoteSection_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeQuestion" ADD CONSTRAINT "PracticeQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "PracticeExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_listeningSectionId_fkey" FOREIGN KEY ("listeningSectionId") REFERENCES "ListeningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ListeningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingCriterionLog" ADD CONSTRAINT "SpeakingCriterionLog_speakingAnswerId_fkey" FOREIGN KEY ("speakingAnswerId") REFERENCES "SpeakingAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingCriterionLog" ADD CONSTRAINT "SpeakingCriterionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingPart" ADD CONSTRAINT "SpeakingPart_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingQuestion" ADD CONSTRAINT "SpeakingQuestion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSamplePart" ADD CONSTRAINT "SpeakingSamplePart_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "SpeakingSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSampleQuestion" ADD CONSTRAINT "SpeakingSampleQuestion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingSamplePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WritingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingCriterionLog" ADD CONSTRAINT "WritingCriterionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingCriterionLog" ADD CONSTRAINT "WritingCriterionLog_writingAnswerId_fkey" FOREIGN KEY ("writingAnswerId") REFERENCES "WritingAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTask" ADD CONSTRAINT "WritingTask_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
