ALTER TABLE "WritingAnswer" ADD COLUMN "gradingToken" TEXT;
ALTER TABLE "WritingAnswer" ADD COLUMN "gradingAttempts" INTEGER NOT NULL DEFAULT 0;
