const { PrismaClient } = require('@prisma/client');
const { isVietnameseTranslation, classifyFamily } = require('./generate-explanations');

const prisma = new PrismaClient();

async function main() {
  console.log('=== ĐẾM BẢN GHI DEV DB CÓ TRANSLATION / FULL_SENTENCE ===');

  const totalQ = await prisma.question.count();
  const totalPQ = await prisma.practiceQuestion.count();

  // 1. Question (Exam)
  const examQuestions = await prisma.question.findMany({
    where: { explanation: { not: null } },
    select: { id: true, type: true, explanation: true }
  });

  // 2. PracticeQuestion (Practice)
  const practiceQuestions = await prisma.practiceQuestion.findMany({
    where: { explanation: { not: null } },
    select: { id: true, type: true, explanation: true }
  });

  console.log(`Toàn bộ DB dev: ${totalQ} Question, ${totalPQ} PracticeQuestion`);
  console.log(`Số Question có explanation: ${examQuestions.length}`);
  console.log(`Số PracticeQuestion có explanation: ${practiceQuestions.length}`);

  for (const q of examQuestions) {
    const exp = typeof q.explanation === 'string' ? JSON.parse(q.explanation) : q.explanation;
    console.log(`\nExam Q ID ${q.id} type=${q.type}:`);
    console.log('translation:', JSON.stringify(exp?.translation));
    console.log('full_sentence:', JSON.stringify(exp?.full_sentence));
  }
  for (const pq of practiceQuestions) {
    const exp = typeof pq.explanation === 'string' ? JSON.parse(pq.explanation) : pq.explanation;
    console.log(`\nPractice Q ID ${pq.id} type=${pq.type}:`);
    console.log('keys:', Object.keys(exp || {}));
    if (exp?.byNumber) {
      console.log('byNumber sub-keys:', Object.keys(exp.byNumber));
      for (const [subKey, subVal] of Object.entries(exp.byNumber)) {
        console.log(`  subKey ${subKey}: translation=${JSON.stringify(subVal?.translation)}, full_sentence=${JSON.stringify(subVal?.full_sentence)}`);
      }
    } else {
      console.log('translation:', JSON.stringify(exp?.translation));
      console.log('full_sentence:', JSON.stringify(exp?.full_sentence));
    }
  }

  let nonCompletionWithTranslationOrFullSentence = 0;
  let nonCompletionExam = 0;
  let nonCompletionPractice = 0;

  let completionWithMixedTranslation = 0;
  let completionExamMixed = 0;
  let completionPracticeMixed = 0;

  let totalWithTranslation = 0;
  let totalWithFullSentence = 0;

  function checkRecord(q, isPractice = false) {
    const exp = typeof q.explanation === 'string' ? JSON.parse(q.explanation) : q.explanation;
    if (!exp) return;

    const family = classifyFamily(q.type);
    const hasTranslation = Boolean(exp.translation && String(exp.translation).trim());
    const hasFullSentence = Boolean(exp.full_sentence && String(exp.full_sentence).trim());

    if (hasTranslation) totalWithTranslation++;
    if (hasFullSentence) totalWithFullSentence++;

    if (family !== 'COMPLETION') {
      if (hasTranslation || hasFullSentence) {
        nonCompletionWithTranslationOrFullSentence++;
        if (isPractice) nonCompletionPractice++;
        else nonCompletionExam++;
        // console.log(`[Non-completion] ID ${q.id} type=${q.type} fam=${family} trans=${exp.translation ? exp.translation.slice(0, 30) : ''}`);
      }
    } else {
      if (hasTranslation) {
        const isVn = isVietnameseTranslation(exp.translation);
        if (!isVn) {
          completionWithMixedTranslation++;
          if (isPractice) completionPracticeMixed++;
          else completionExamMixed++;
          console.log(`[Mixed/Invalid translation in Completion] ID ${q.id} trans="${exp.translation}"`);
        }
      }
    }
  }

  for (const q of examQuestions) checkRecord(q, false);
  for (const q of practiceQuestions) checkRecord(q, true);

  console.log('\n--- KẾT QUẢ ĐẾM TRÊN DEV DB ---');
  console.log(`1. Tổng số bản ghi có translation: ${totalWithTranslation}`);
  console.log(`2. Tổng số bản ghi có full_sentence: ${totalWithFullSentence}`);
  console.log(`3. Bản ghi ở họ KHÔNG PHẢI COMPLETION có translation/full_sentence: ${nonCompletionWithTranslationOrFullSentence} (Exam: ${nonCompletionExam}, Practice: ${nonCompletionPractice})`);
  console.log(`4. Bản ghi họ COMPLETION có translation trộn Anh-Việt / không hợp lệ: ${completionWithMixedTranslation} (Exam: ${completionExamMixed}, Practice: ${completionPracticeMixed})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
