-- AlterTable: Add subtitle, letteredParagraphs to Passage
ALTER TABLE "Passage" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "Passage" ADD COLUMN "letteredParagraphs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Make sectionId nullable, add passageId and canReuse to QuestionGroup
ALTER TABLE "QuestionGroup" ALTER COLUMN "sectionId" DROP NOT NULL;
ALTER TABLE "QuestionGroup" ADD COLUMN "passageId" INTEGER;
ALTER TABLE "QuestionGroup" ADD COLUMN "canReuse" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey: QuestionGroup -> Passage
ALTER TABLE "QuestionGroup" ADD CONSTRAINT "QuestionGroup_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "Passage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
