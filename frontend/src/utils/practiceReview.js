const GROUP_QUESTION_TYPE = {
  note_completion: 'fill_blank',
  table_completion: 'fill_blank',
  true_false_ng: 'true_false_ng',
  yes_no_ng: 'yes_no_ng',
  mcq: 'mcq',
  mcq_multi: 'mcq_multi',
}

function reviewGroups(groups) {
  return (groups || []).map(g => ({
    ...g,
    questions: (g.questions || []).map(q => ({
      ...q,
      id: q.id ?? q.number,
      type: q.type || GROUP_QUESTION_TYPE[g.type] || g.type,
    })),
  }))
}

export function buildPracticeReviewExam(exam, skill) {
  const questionGroups = reviewGroups(exam?.questions?.groups)
  if (skill === 'listening') {
    return {
      title: exam?.title,
      listeningSections: [{
        id: exam?.id,
        number: 1,
        context: '',
        audioUrl: exam?.audioUrl || null,
        transcript: exam?.transcript || '',
        questions: [],
        questionGroups,
      }],
    }
  }
  return {
    title: exam?.title,
    passages: [{
      id: exam?.id,
      number: 1,
      title: exam?.title,
      body: exam?.passage || '',
      letteredParagraphs: false,
      questions: [],
      questionGroups,
    }],
  }
}
