/*
  Warnings:

  - You are about to drop the column `examId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the `Attempt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Exam` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `groupId` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionNumber` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_examId_fkey";

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_userId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_examId_fkey";

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "examId",
DROP COLUMN "type",
ADD COLUMN     "acceptableAnswers" TEXT,
ADD COLUMN     "groupId" INTEGER NOT NULL,
ADD COLUMN     "matchKey" TEXT,
ADD COLUMN     "questionNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "targetBand" DOUBLE PRECISION;

-- DropTable
DROP TABLE "Attempt";

-- DropTable
DROP TABLE "Exam";

-- CreateTable
CREATE TABLE "FullTest" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FullTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSection" (
    "id" SERIAL NOT NULL,
    "fullTestId" INTEGER,
    "skill" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeLimitMinutes" INTEGER NOT NULL,
    "orderInTest" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningTest" (
    "id" SERIAL NOT NULL,
    "testSectionId" INTEGER NOT NULL,

    CONSTRAINT "ListeningTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningSection" (
    "id" SERIAL NOT NULL,
    "listeningTestId" INTEGER NOT NULL,
    "sectionNumber" INTEGER NOT NULL,
    "audioUrl" TEXT,
    "transcript" TEXT,
    "context" TEXT NOT NULL,

    CONSTRAINT "ListeningSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingTest" (
    "id" SERIAL NOT NULL,
    "testSectionId" INTEGER NOT NULL,

    CONSTRAINT "ReadingTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingPassage" (
    "id" SERIAL NOT NULL,
    "readingTestId" INTEGER NOT NULL,
    "passageNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hasHeadings" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReadingPassage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassageParagraph" (
    "id" SERIAL NOT NULL,
    "passageId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "PassageParagraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingTest" (
    "id" SERIAL NOT NULL,
    "testSectionId" INTEGER NOT NULL,

    CONSTRAINT "WritingTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingTask" (
    "id" SERIAL NOT NULL,
    "writingTestId" INTEGER NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "taskType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "minWords" INTEGER NOT NULL,
    "timeSuggestionMinutes" INTEGER NOT NULL,

    CONSTRAINT "WritingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingTest" (
    "id" SERIAL NOT NULL,
    "testSectionId" INTEGER NOT NULL,

    CONSTRAINT "SpeakingTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingPart" (
    "id" SERIAL NOT NULL,
    "speakingTestId" INTEGER NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "partType" TEXT NOT NULL,
    "topic" TEXT,
    "cueCardPrompt" TEXT,
    "preparationSecs" INTEGER,
    "speakingTimeSecs" INTEGER NOT NULL,

    CONSTRAINT "SpeakingPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingQuestion" (
    "id" SERIAL NOT NULL,
    "partId" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "orderInPart" INTEGER NOT NULL,

    CONSTRAINT "SpeakingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" SERIAL NOT NULL,
    "listeningSectionId" INTEGER,
    "readingPassageId" INTEGER,
    "groupType" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "contextData" TEXT,
    "questionNumberStart" INTEGER NOT NULL,
    "questionNumberEnd" INTEGER NOT NULL,

    CONSTRAINT "QuestionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FullTestAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fullTestId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "FullTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "testSectionId" INTEGER NOT NULL,
    "fullTestAttemptId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "timeTakenSecs" INTEGER,

    CONSTRAINT "SectionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAnswer" (
    "id" SERIAL NOT NULL,
    "sectionAttemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,

    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingAnswer" (
    "id" SERIAL NOT NULL,
    "sectionAttemptId" INTEGER NOT NULL,
    "writingTaskId" INTEGER NOT NULL,
    "essayText" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "WritingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingAnswer" (
    "id" SERIAL NOT NULL,
    "sectionAttemptId" INTEGER NOT NULL,
    "speakingPartId" INTEGER NOT NULL,
    "transcript" TEXT,
    "audioPath" TEXT,
    "aiFeedback" TEXT,
    "aiScore" DOUBLE PRECISION,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "SpeakingAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionScore" (
    "id" SERIAL NOT NULL,
    "sectionAttemptId" INTEGER NOT NULL,
    "rawScore" DOUBLE PRECISION,
    "bandScore" DOUBLE PRECISION NOT NULL,
    "breakdown" TEXT,

    CONSTRAINT "SectionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByUserId" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "parseError" TEXT,
    "resultTestSectionId" INTEGER,
    "skill" TEXT,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListeningTest_testSectionId_key" ON "ListeningTest"("testSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingTest_testSectionId_key" ON "ReadingTest"("testSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingTest_testSectionId_key" ON "WritingTest"("testSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpeakingTest_testSectionId_key" ON "SpeakingTest"("testSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionScore_sectionAttemptId_key" ON "SectionScore"("sectionAttemptId");

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_fullTestId_fkey" FOREIGN KEY ("fullTestId") REFERENCES "FullTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningTest" ADD CONSTRAINT "ListeningTest_testSectionId_fkey" FOREIGN KEY ("testSectionId") REFERENCES "TestSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningSection" ADD CONSTRAINT "ListeningSection_listeningTestId_fkey" FOREIGN KEY ("listeningTestId") REFERENCES "ListeningTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingTest" ADD CONSTRAINT "ReadingTest_testSectionId_fkey" FOREIGN KEY ("testSectionId") REFERENCES "TestSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingPassage" ADD CONSTRAINT "ReadingPassage_readingTestId_fkey" FOREIGN KEY ("readingTestId") REFERENCES "ReadingTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassageParagraph" ADD CONSTRAINT "PassageParagraph_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "ReadingPassage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTest" ADD CONSTRAINT "WritingTest_testSectionId_fkey" FOREIGN KEY ("testSectionId") REFERENCES "TestSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingTask" ADD CONSTRAINT "WritingTask_writingTestId_fkey" FOREIGN KEY ("writingTestId") REFERENCES "WritingTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingTest" ADD CONSTRAINT "SpeakingTest_testSectionId_fkey" FOREIGN KEY ("testSectionId") REFERENCES "TestSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingPart" ADD CONSTRAINT "SpeakingPart_speakingTestId_fkey" FOREIGN KEY ("speakingTestId") REFERENCES "SpeakingTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingQuestion" ADD CONSTRAINT "SpeakingQuestion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SpeakingPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_listeningSectionId_fkey" FOREIGN KEY ("listeningSectionId") REFERENCES "ListeningSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_readingPassageId_fkey" FOREIGN KEY ("readingPassageId") REFERENCES "ReadingPassage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "QuestionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FullTestAttempt" ADD CONSTRAINT "FullTestAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FullTestAttempt" ADD CONSTRAINT "FullTestAttempt_fullTestId_fkey" FOREIGN KEY ("fullTestId") REFERENCES "FullTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAttempt" ADD CONSTRAINT "SectionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAttempt" ADD CONSTRAINT "SectionAttempt_testSectionId_fkey" FOREIGN KEY ("testSectionId") REFERENCES "TestSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionAttempt" ADD CONSTRAINT "SectionAttempt_fullTestAttemptId_fkey" FOREIGN KEY ("fullTestAttemptId") REFERENCES "FullTestAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingAnswer" ADD CONSTRAINT "WritingAnswer_writingTaskId_fkey" FOREIGN KEY ("writingTaskId") REFERENCES "WritingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAnswer" ADD CONSTRAINT "SpeakingAnswer_speakingPartId_fkey" FOREIGN KEY ("speakingPartId") REFERENCES "SpeakingPart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionScore" ADD CONSTRAINT "SectionScore_sectionAttemptId_fkey" FOREIGN KEY ("sectionAttemptId") REFERENCES "SectionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
