const savedId = value => Number.isSafeInteger(value) && value > 0
const optionsArray = value => {
  if (Array.isArray(value)) return value
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

export function buildExamPayload(form, skill) {
  const key = skill === 'reading' ? 'passages' : 'sections'
  return {
    title: form.title,
    bookNumber: form.bookNumber ? Number(form.bookNumber) : null,
    testNumber: form.testNumber ? Number(form.testNumber) : null,
    seriesId: form.seriesId ? Number(form.seriesId) : null,
    [key]: (form[key] || []).map(part => ({
      ...(savedId(part.id) ? { id: part.id } : {}), number: part.number,
      ...(skill === 'reading' ? { title: part.title, subtitle: part.subtitle || null, letteredParagraphs: Boolean(part.letteredParagraphs), body: part.body }
        : { context: part.context || '', audioUrl: part.audioUrl || null, transcript: part.transcript || null }),
      questionGroups: (part.questionGroups || []).map(g => ({
        ...(savedId(g.id) ? { id: g.id } : { isNew: true }),
        type: g.type, qNumberStart: g.qNumberStart, qNumberEnd: g.qNumberEnd,
        instruction: g.instruction || '', imageUrl: g.imageUrl || null,
        maxChoices: g.maxChoices || 2, canReuse: Boolean(g.canReuse),
        noteSections: g.noteSections || [], matchingOptions: g.matchingOptions || [],
        questions: (g.questions || []).map(q => ({
          ...(savedId(q.id) ? { id: q.id } : { isNew: true }),
          number: q.number,
          questionText: g.type === 'diagram_label' ? (q.hint ?? q.questionText ?? '') : (q.questionText || ''),
          ...(g.type === 'diagram_label' ? { hint: q.hint ?? q.questionText ?? '' } : {}),
          options: optionsArray(q.options), correctAnswer: q.correctAnswer || '',
        })),
      })),
    })),
  }
}

export function hydrateExamForm(exam, skill, previous) {
  const key = skill === 'reading' ? 'passages' : 'sections'
  const parts = skill === 'reading' ? exam.passages : exam.listeningSections
  if (!Array.isArray(parts)) throw new Error('Phản hồi lưu đề thiếu nội dung đã lưu. Vui lòng tải lại đề trước khi sửa tiếp.')
  return {
    title: exam.title || '', bookNumber: String(exam.bookNumber || ''),
    testNumber: String(exam.testNumber || ''), seriesId: String(exam.seriesId || ''),
    [key]: parts.map(part => {
      const oldPart = previous?.[key]?.find(p => p.id === part.id || p.number === part.number)
      return {
        id: part.id, number: part.number,
        ...(skill === 'reading' ? { title: part.title || '', subtitle: part.subtitle || '', body: part.body || '', letteredParagraphs: Boolean(part.letteredParagraphs) }
          : { context: part.context || '', audioUrl: part.audioUrl || '', transcript: part.transcript || '' }),
        questionGroups: (part.questionGroups || []).map((g, gi) => {
          if (!Array.isArray(g.questions)) throw new Error('Phản hồi lưu đề thiếu ID câu hỏi. Vui lòng tải lại đề trước khi sửa tiếp.')
          const old = oldPart?.questionGroups?.find(o => o.id === g.id) || oldPart?.questionGroups?.[gi]
          return {
            id: g.id, _id: old && (!old.id || old.id === g.id) ? old._id ?? g.id : g.id,
            type: g.type, qNumberStart: g.qNumberStart, qNumberEnd: g.qNumberEnd,
            instruction: g.instruction || '', imageUrl: g.imageUrl || '',
            maxChoices: g.maxChoices || 2, canReuse: Boolean(g.canReuse),
            noteSections: (g.noteSections || []).map(s => ({ title: s.title || '', lines: (s.lines || []).map(l => ({ content: l.contentWithTokens ?? l.content ?? '', lineType: l.lineType || 'content' })) })),
            matchingOptions: (g.matchingOptions || []).map(o => ({ letter: o.optionLetter ?? o.letter ?? '', text: o.optionText ?? o.text ?? '' })),
            questions: g.questions.map(q => ({ id: q.id, number: q.number, questionText: q.questionText || '', ...(g.type === 'diagram_label' ? { hint: q.questionText || '' } : {}), options: optionsArray(q.options), correctAnswer: q.correctAnswer || '', explanation: q.explanation || null })),
            explanations: Object.fromEntries(g.questions.filter(q => q.explanation).map(q => [q.number, q.explanation])),
          }
        }),
      }
    }),
  }
}
