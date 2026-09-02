// ─── PER-SKILL CONFIG cho <ContentCard> ──────────────────────────────────────
// Gom mọi khác biệt theo kỹ năng vào đây, giống pattern CONFIG của
// pages/admin/SampleManager.jsx. <ContentCard> bản thân nó KHÔNG biết gì về
// "reading" / "writing" — parent tra cứu config rồi truyền prop cụ thể vào.
//
// - placeholder: dùng khi item không có ảnh (bg + icon; icon là string emoji
//   hoặc ReactNode do parent tự dựng, vd lucide <BookOpen/>).
// - levelLabels / levelFallback / levelTones: chỉ dùng cho card bài mẫu
//   Writing/Speaking (meta dạng chips) — xem buildSampleChips bên dưới.
//   `tone` là tên tone trong CHIP_TONES của ContentCard.jsx.

export const CONTENT_CARD_CONFIG = {
  reading: {
    placeholder: { bg: 'var(--skill-r-bg)', icon: '📖' },
  },
  listening: {
    placeholder: { bg: 'var(--skill-l-bg)', icon: '🎧' },
  },
  writing: {
    placeholder: { bg: 'var(--skill-w-bg)', icon: '✍️' },
    levelLabels: { task1: 'Task 1', task2: 'Task 2' },
    levelFallback: 'Writing',
    levelTones: { task1: 'writing', task2: 'neutral' },
  },
  speaking: {
    placeholder: { bg: 'var(--skill-s-bg)', icon: '🎤' },
    levelLabels: { task1: 'Part 1', task2: 'Part 2', task3: 'Part 3' },
    levelFallback: 'Speaking',
    levelTones: { task1: 'speaking', task2: 'neutral', task3: 'writing' },
  },
  fullTest: {
    placeholder: { bg: 'var(--border)', icon: '📚' },
  },
}

// Dựng mảng chips meta cho card bài mẫu Writing/Speaking (V4/V5):
//   [ pill level (Task 1 / Part 2 / …), pill examType? ]
// Giữ nguyên fallback của SampleCard cũ: level lạ → nhãn "Writing"/"Speaking",
// tone "neutral" (trùng tone task2 cũ).
export function buildSampleChips(skill, item) {
  const cfg = CONTENT_CARD_CONFIG[skill]
  if (!cfg || !cfg.levelLabels) return []
  const chips = [{
    label: cfg.levelLabels[item.level] || cfg.levelFallback,
    tone: cfg.levelTones[item.level] || 'neutral',
  }]
  if (item.examType) chips.push({ label: item.examType, tone: 'neutral' })
  return chips
}
