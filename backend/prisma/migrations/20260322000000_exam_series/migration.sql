-- Create ExamSeries table
CREATE TABLE "ExamSeries" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Cambridge series (will get id=1)
INSERT INTO "ExamSeries" ("name") VALUES ('IELTS Cambridge');

-- Add seriesId to Exam
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "seriesId" INTEGER;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE SET NULL;
UPDATE "Exam" SET "seriesId" = 1 WHERE "bookNumber" IS NOT NULL;

-- Backup old BookCover
ALTER TABLE "BookCover" RENAME TO "_BookCover_backup";

-- Create new BookCover with series support
CREATE TABLE "BookCover" (
  "id" SERIAL PRIMARY KEY,
  "seriesId" INTEGER NOT NULL,
  "bookNumber" INTEGER NOT NULL,
  "coverImageUrl" TEXT,
  CONSTRAINT "BookCover_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "ExamSeries"("id") ON DELETE CASCADE,
  CONSTRAINT "BookCover_seriesId_bookNumber_key" UNIQUE ("seriesId", "bookNumber")
);

-- Migrate existing cover data
INSERT INTO "BookCover" ("seriesId", "bookNumber", "coverImageUrl")
SELECT 1, "bookNumber", "coverImageUrl" FROM "_BookCover_backup";

-- Add all 19 Cambridge books (those without covers get null coverImageUrl)
INSERT INTO "BookCover" ("seriesId", "bookNumber")
SELECT 1, g.n
FROM generate_series(1, 19) AS g(n)
WHERE NOT EXISTS (
  SELECT 1 FROM "BookCover" WHERE "seriesId" = 1 AND "bookNumber" = g.n
);

-- Drop backup
DROP TABLE "_BookCover_backup";
