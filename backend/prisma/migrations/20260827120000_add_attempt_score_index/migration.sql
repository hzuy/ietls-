-- Add standalone index on Attempt.score for global band-score sorting
-- Used by GET /api/admin/attempts?sortBy=score&sortOrder=asc|desc (Lịch sử thi page)
-- Existing compound indexes ([userId, score], [examId, score]) don't help a
-- table-wide ORDER BY score with no user/exam predicate.

CREATE INDEX IF NOT EXISTS "Attempt_score_idx" ON "Attempt"("score");
