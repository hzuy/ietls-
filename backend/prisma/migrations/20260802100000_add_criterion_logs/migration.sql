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

-- CreateIndex
CREATE INDEX "WritingCriterionLog_userId_criterion_idx" ON "WritingCriterionLog"("userId", "criterion");

-- CreateIndex
CREATE INDEX "WritingCriterionLog_writingAnswerId_idx" ON "WritingCriterionLog"("writingAnswerId");

-- CreateIndex
CREATE INDEX "SpeakingCriterionLog_userId_criterion_idx" ON "SpeakingCriterionLog"("userId", "criterion");

-- CreateIndex
CREATE INDEX "SpeakingCriterionLog_speakingAnswerId_idx" ON "SpeakingCriterionLog"("speakingAnswerId");

-- AddForeignKey
ALTER TABLE "WritingCriterionLog" ADD CONSTRAINT "WritingCriterionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingCriterionLog" ADD CONSTRAINT "WritingCriterionLog_writingAnswerId_fkey" FOREIGN KEY ("writingAnswerId") REFERENCES "WritingAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingCriterionLog" ADD CONSTRAINT "SpeakingCriterionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingCriterionLog" ADD CONSTRAINT "SpeakingCriterionLog_speakingAnswerId_fkey" FOREIGN KEY ("speakingAnswerId") REFERENCES "SpeakingAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
