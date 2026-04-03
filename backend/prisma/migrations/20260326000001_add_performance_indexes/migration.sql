-- Performance indexes migration
-- Thêm index cho các cột thường xuyên được dùng trong WHERE, JOIN, ORDER BY

-- Exam: lọc theo skill (mọi endpoint exam list) + full-test grouping
CREATE INDEX "Exam_skill_idx" ON "Exam"("skill");
CREATE INDEX "Exam_seriesId_bookNumber_testNumber_idx" ON "Exam"("seriesId", "bookNumber", "testNumber");

-- Attempt: lọc theo user, exam, composite, date range (analytics + fulltest)
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");
CREATE INDEX "Attempt_userId_examId_idx" ON "Attempt"("userId", "examId");
CREATE INDEX "Attempt_finishedAt_idx" ON "Attempt"("finishedAt");

-- Question: join với passage, listeningSection, group
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");
CREATE INDEX "Question_listeningSectionId_idx" ON "Question"("listeningSectionId");
CREATE INDEX "Question_groupId_idx" ON "Question"("groupId");

-- QuestionAnswer: join với attempt và question
CREATE INDEX "QuestionAnswer_attemptId_idx" ON "QuestionAnswer"("attemptId");
CREATE INDEX "QuestionAnswer_questionId_idx" ON "QuestionAnswer"("questionId");

-- WritingAnswer: lọc theo user + task (fulltest status check)
CREATE INDEX "WritingAnswer_userId_idx" ON "WritingAnswer"("userId");
CREATE INDEX "WritingAnswer_taskId_idx" ON "WritingAnswer"("taskId");
CREATE INDEX "WritingAnswer_userId_taskId_idx" ON "WritingAnswer"("userId", "taskId");

-- SpeakingAnswer: lọc theo user + part (fulltest status check)
CREATE INDEX "SpeakingAnswer_userId_idx" ON "SpeakingAnswer"("userId");
CREATE INDEX "SpeakingAnswer_partId_idx" ON "SpeakingAnswer"("partId");
CREATE INDEX "SpeakingAnswer_userId_partId_idx" ON "SpeakingAnswer"("userId", "partId");
