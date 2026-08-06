-- CreateTable: AnswerLog
-- Bảng lưu log chi tiết từng câu trả lời (đúng/sai) cho mục đích phân tích AI
-- Áp dụng cho: Reading, Listening (các kỹ năng có câu trắc nghiệm có đáp án đúng/sai)
-- KHÔNG áp dụng cho: Writing, Speaking (bài viết tự do, chấm bởi AI)

CREATE TABLE "AnswerLog" (
    "id"            SERIAL PRIMARY KEY,
    "userId"        INTEGER NOT NULL,
    "attemptId"     INTEGER,
    "questionId"    INTEGER NOT NULL,
    "skillType"     TEXT NOT NULL,
    "questionType"  TEXT NOT NULL,
    "isCorrect"     BOOLEAN NOT NULL,
    "userAnswer"    TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_attemptId_fkey"
    FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AnswerLog_userId_skillType_questionType_idx" ON "AnswerLog"("userId", "skillType", "questionType");
CREATE INDEX "AnswerLog_userId_isCorrect_idx" ON "AnswerLog"("userId", "isCorrect");
CREATE INDEX "AnswerLog_questionId_idx" ON "AnswerLog"("questionId");
CREATE INDEX "AnswerLog_attemptId_idx" ON "AnswerLog"("attemptId");
