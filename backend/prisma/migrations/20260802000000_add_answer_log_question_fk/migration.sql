-- AlterTable: AnswerLog
-- Bổ sung Foreign Key constraint cho questionId trỏ tới bảng Question(id)

ALTER TABLE "AnswerLog" ADD CONSTRAINT "AnswerLog_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
