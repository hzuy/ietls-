-- DropForeignKey
ALTER TABLE "SeriesExam" DROP CONSTRAINT IF EXISTS "SeriesExam_examId_fkey";
ALTER TABLE "SeriesExam" DROP CONSTRAINT IF EXISTS "SeriesExam_seriesId_fkey";

-- DropForeignKey
ALTER TABLE "SeriesMapping" DROP CONSTRAINT IF EXISTS "SeriesMapping_examSeriesId_fkey";
ALTER TABLE "SeriesMapping" DROP CONSTRAINT IF EXISTS "SeriesMapping_seriesId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "SeriesExam_examId_idx";
DROP INDEX IF EXISTS "SeriesExam_seriesId_idx";
DROP INDEX IF EXISTS "SeriesMapping_examSeriesId_idx";
DROP INDEX IF EXISTS "SeriesMapping_seriesId_idx";
DROP INDEX IF EXISTS "Series_createdAt_idx";
DROP INDEX IF EXISTS "Series_deletedAt_idx";

-- DropTable
DROP TABLE IF EXISTS "SeriesMapping";
DROP TABLE IF EXISTS "SeriesExam";
DROP TABLE IF EXISTS "Series";
