-- TC-064: bổ sung các object đã có trong schema.prisma nhưng chưa từng được
-- tạo bởi migration nào (ErrorReport + các cột phục vụ TC-042/TC-048 và audio
-- Speaking). Migration này forward-only và idempotent để có thể chạy an toàn
-- trên database đang tồn tại (được tạo trước đó bằng `prisma db push`).

-- TC-042: khoá idempotency của lượt nộp Reading/Listening.
ALTER TABLE "Attempt" ADD COLUMN IF NOT EXISTS "submissionKey" TEXT;

-- Audio/TTS cho Speaking Part + câu hỏi (đã có trong schema, thiếu migration).
ALTER TABLE "SpeakingPart" ADD COLUMN IF NOT EXISTS "introAudioUrl" TEXT;
ALTER TABLE "SpeakingPart" ADD COLUMN IF NOT EXISTS "introTtsScript" TEXT;
ALTER TABLE "SpeakingQuestion" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT;
ALTER TABLE "SpeakingQuestion" ADD COLUMN IF NOT EXISTS "ttsScript" TEXT;

-- TC-048: mốc thời gian bắt đầu chấm để recovery phát hiện job bị treo.
ALTER TABLE "WritingAnswer" ADD COLUMN IF NOT EXISTS "gradingStartedAt" TIMESTAMP(3);

-- TC-064: bảng báo lỗi nội dung do người học gửi.
CREATE TABLE IF NOT EXISTS "ErrorReport" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "examId" INTEGER,
    "practiceExamId" INTEGER,
    "skill" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "location" TEXT,
    "questionNumber" INTEGER,
    "issueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErrorReport_status_idx" ON "ErrorReport"("status");
CREATE INDEX IF NOT EXISTS "ErrorReport_createdAt_idx" ON "ErrorReport"("createdAt");
CREATE INDEX IF NOT EXISTS "ErrorReport_skill_idx" ON "ErrorReport"("skill");

-- TC-042: unique [userId, examId, submissionKey]. PostgreSQL cho phép nhiều NULL
-- nên các Attempt cũ chưa có submissionKey không bị ảnh hưởng.
CREATE UNIQUE INDEX IF NOT EXISTS "Attempt_userId_examId_submissionKey_key"
    ON "Attempt"("userId", "examId", "submissionKey");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ErrorReport_userId_fkey'
    ) THEN
        ALTER TABLE "ErrorReport"
            ADD CONSTRAINT "ErrorReport_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
