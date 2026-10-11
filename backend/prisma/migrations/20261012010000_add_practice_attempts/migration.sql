-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "practiceExamId" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_practiceExamId_idx" ON "PracticeAttempt"("userId", "practiceExamId");

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_practiceExamId_fkey" FOREIGN KEY ("practiceExamId") REFERENCES "PracticeExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
