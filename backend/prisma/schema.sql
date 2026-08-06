-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "requirePasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "bookNumber" INTEGER,
    "testNumber" INTEGER,
    "coverImageUrl" TEXT,
    "seriesId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Passage" (
    "id" SERIAL NOT NULL,
    "examId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT NOT NULL,
    "letteredParagraphs" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Passage_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "passageId" INTEGER,
    "listeningSectionId" INTEGER,
    "groupId" INTEGER,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Attempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "examId" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "aiFeedback" TEXT,
    "answers" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "WritingAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "essayText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WritingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingAnswer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL,
    "transcript" TEXT,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER,
    "passageId" INTEGER,
    "qNumberStart" INTEGER NOT NULL DEFAULT 1,
    "qNumberEnd" INTEGER NOT NULL DEFAULT 1,
    "instruction" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "canReuse" BOOLEAN NOT NULL DEFAULT false,
    "maxChoices" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "NoteLine" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "contentWithTokens" TEXT NOT NULL DEFAULT '',
    "lineType" TEXT NOT NULL DEFAULT 'content',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NoteLine_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ExamSeries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExamSeries_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "PracticeExam" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "level" TEXT,
    "thumbnailUrl" TEXT,
    "audioUrl" TEXT,
    "passage" TEXT,
    "isNormalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

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
CREATE TABLE "WritingSample" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "examType" TEXT,
    "taskType" TEXT,
    "thumbnailUrl" TEXT,
    "content" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WritingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingSample" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "level" TEXT,
    "examType" TEXT,
    "thumbnailUrl" TEXT,
    "content" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

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
CREATE TABLE "MatchingOption" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "optionLetter" TEXT NOT NULL,
    "optionText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'academic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesExam" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "examId" INTEGER NOT NULL,
    "testNumber" INTEGER NOT NULL,

    CONSTRAINT "SeriesExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeriesMapping" (
    "id" SERIAL NOT NULL,
    "seriesId" INTEGER NOT NULL,
    "examSeriesId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeriesMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Exam_skill_idx" ON "Exam"("skill");

-- CreateIndex
CREATE INDEX "Exam_seriesId_bookNumber_testNumber_idx" ON "Exam"("seriesId", "bookNumber", "testNumber");

-- CreateIndex
CREATE INDEX "Exam_createdAt_idx" ON "Exam"("createdAt");

-- CreateIndex
CREATE INDEX "Question_passageId_idx" ON "Question"("passageId");

-- CreateIndex
CREATE INDEX "Question_listeningSectionId_idx" ON "Question"("listeningSectionId");

-- CreateIndex
CREATE INDEX "Question_groupId_idx" ON "Question"("groupId");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId");

-- CreateIndex
CREATE INDEX "Attempt_userId_examId_idx" ON "Attempt"("userId", "examId");

-- CreateIndex
CREATE INDEX "Attempt_finishedAt_idx" ON "Attempt"("finishedAt");

-- CreateIndex
CREATE INDEX "Attempt_createdAt_idx" ON "Attempt"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionAnswer_attemptId_idx" ON "QuestionAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuestionAnswer_questionId_idx" ON "QuestionAnswer"("questionId");

-- CreateIndex
CREATE INDEX "WritingAnswer_userId_idx" ON "WritingAnswer"("userId");

-- CreateIndex
CREATE INDEX "WritingAnswer_taskId_idx" ON "WritingAnswer"("taskId");

-- CreateIndex
CREATE INDEX "WritingAnswer_userId_taskId_idx" ON "WritingAnswer"("userId", "taskId");

-- CreateIndex
CREATE INDEX "WritingAnswer_createdAt_idx" ON "WritingAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_userId_idx" ON "SpeakingAnswer"("userId");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_partId_idx" ON "SpeakingAnswer"("partId");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_userId_partId_idx" ON "SpeakingAnswer"("userId", "partId");

-- CreateIndex
CREATE INDEX "SpeakingAnswer_createdAt_idx" ON "SpeakingAnswer"("createdAt");

-- CreateIndex
CREATE INDEX "QuestionGroup_sectionId_idx" ON "QuestionGroup"("sectionId");

-- CreateIndex
CREATE INDEX "QuestionGroup_passageId_idx" ON "QuestionGroup"("passageId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCover_seriesId_bookNumber_key" ON "BookCover"("seriesId", "bookNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "PracticeExam_skill_idx" ON "PracticeExam"("skill");

-- CreateIndex
CREATE INDEX "PracticeExam_createdAt_idx" ON "PracticeExam"("createdAt");

-- CreateIndex
CREATE INDEX "WritingSample_createdAt_idx" ON "WritingSample"("createdAt");

-- CreateIndex
CREATE INDEX "SpeakingSample_createdAt_idx" ON "SpeakingSample"("createdAt");

-- CreateIndex
CREATE INDEX "Series_createdAt_idx" ON "Series"("createdAt");

-- CreateIndex
CREATE INDEX "SeriesExam_seriesId_idx" ON "SeriesExam"("seriesId");

-- CreateIndex
CREATE INDEX "SeriesExam_examId_idx" ON "SeriesExam"("examId");

-- CreateIndex
CREATE INDEX "SeriesMapping_seriesId_idx" ON "SeriesMapping"("seriesId");

-- CreateIndex
CREATE INDEX "SeriesMapping_examSeriesId_idx" ON "SeriesMapping"("examSeriesId");

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Passage" ADD CONSTRAINT "Passage_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSection" ADD CONSTRAINT "ListeningSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_listeningSectionId_fkey" FOREIGN KEY ("listeningSectionId") REFERENCES "ListeningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTask" ADD CONSTRAINT "WritingTask_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingPart" ADD CONSTRAINT "SpeakingPart_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingQuestion" ADD CONSTRAINT "SpeakingQuestion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WritingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ListeningSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteSection" ADD CONSTRAINT "NoteSection_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteLine" ADD CONSTRAINT "NoteLine_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "NoteSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCover" ADD CONSTRAINT "BookCover_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeQuestion" ADD CONSTRAINT "PracticeQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "PracticeExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSamplePart" ADD CONSTRAINT "SpeakingSamplePart_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "SpeakingSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingSampleQuestion" ADD CONSTRAINT "SpeakingSampleQuestion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingSamplePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingOption" ADD CONSTRAINT "MatchingOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesExam" ADD CONSTRAINT "SeriesExam_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesExam" ADD CONSTRAINT "SeriesExam_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesMapping" ADD CONSTRAINT "SeriesMapping_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeriesMapping" ADD CONSTRAINT "SeriesMapping_examSeriesId_fkey" FOREIGN KEY ("examSeriesId") REFERENCES "ExamSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

