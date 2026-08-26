-- Add deletedAt indexes for soft-delete query performance
-- Affected models: ExamSeries, BookCover, Series
-- These tables are frequently filtered with WHERE deletedAt IS NULL or IS NOT NULL

-- ExamSeries: filtered in trash, exam-series list endpoints
CREATE INDEX IF NOT EXISTS "ExamSeries_deletedAt_idx" ON "ExamSeries"("deletedAt");

-- BookCover: filtered in trash, book management endpoints
CREATE INDEX IF NOT EXISTS "BookCover_deletedAt_idx" ON "BookCover"("deletedAt");
CREATE INDEX IF NOT EXISTS "BookCover_seriesId_idx" ON "BookCover"("seriesId");

-- Series: filtered in trash, series list endpoints
CREATE INDEX IF NOT EXISTS "Series_deletedAt_idx" ON "Series"("deletedAt");
