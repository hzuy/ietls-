const topicPrefix = '##TOPIC##:'

function questionRecord(question) {
  if (typeof question === 'string') return { questionText: question, audioUrl: null, ttsScript: null }
  return {
    ...(question.id != null ? { id: question.id } : {}),
    questionText: question.questionText || '',
    audioUrl: question.audioUrl ?? null,
    ttsScript: question.ttsScript ?? null,
  }
}

// Keep the editor's string array while carrying the matching metadata in drafts.
// Topic rows are not editable questions in Part 3, but must survive round trips.
export function loadSpeakingQuestions(questions = [], hideTopics = false) {
  const texts = []
  const metadata = []
  let pendingTopics = []
  for (const question of questions) {
    const record = questionRecord(question)
    if (hideTopics && record.questionText.startsWith(topicPrefix)) {
      pendingTopics.push(record)
      continue
    }
    texts.push(record.questionText)
    metadata.push({ ...record, originalText: record.questionText, topicMarkers: pendingTopics })
    pendingTopics = []
  }
  return {
    questions: texts.length ? texts : [''],
    _questionMetadata: metadata.length ? metadata : [{}],
    _trailingTopicMarkers: pendingTopics,
  }
}

export function serializeSpeakingQuestions(part) {
  const result = []
  ;(part.questions || []).forEach((text, index) => {
    const metadata = part._questionMetadata?.[index] || {}
    result.push(...(metadata.topicMarkers || []))
    if (!text.trim()) return
    const unchanged = metadata.originalText === text
    result.push({
      ...(metadata.id != null ? { id: metadata.id } : {}),
      questionText: text,
      audioUrl: unchanged ? metadata.audioUrl ?? null : null,
      ttsScript: unchanged ? metadata.ttsScript ?? null : null,
    })
  })
  result.push(...(part._trailingTopicMarkers || []))
  return result
}

export function addSpeakingQuestion(part) {
  return {
    ...part,
    questions: [...part.questions, ''],
    _questionMetadata: [
      ...part.questions.map((_, index) => part._questionMetadata?.[index] || {}),
      { topicMarkers: part._trailingTopicMarkers || [] },
    ],
    _trailingTopicMarkers: [],
  }
}

export function removeSpeakingQuestion(part, index) {
  const metadata = part.questions.map((_, itemIndex) => ({ ...part._questionMetadata?.[itemIndex] }))
  const removedTopics = metadata[index]?.topicMarkers || []
  const texts = part.questions.filter((_, itemIndex) => itemIndex !== index)
  metadata.splice(index, 1)
  const trailing = [...(part._trailingTopicMarkers || [])]
  if (metadata[index]) metadata[index].topicMarkers = [...removedTopics, ...(metadata[index].topicMarkers || [])]
  else trailing.unshift(...removedTopics)
  return {
    ...part,
    questions: texts.length ? texts : [''],
    _questionMetadata: metadata.length ? metadata : [{}],
    _trailingTopicMarkers: trailing,
  }
}

// Older drafts only contain question strings. Reuse metadata only for a matching
// unchanged text (consuming duplicates once), never by an assumed array index.
export function restoreSpeakingDraft(draft, current) {
  const result = { ...current, ...draft }
  for (const key of ['part1', 'part2', 'part3']) {
    const previous = current[key] || {}
    const restored = { ...previous, ...draft[key] }
    if (draft[key]?._questionMetadata) {
      result[key] = restored
      continue
    }
    const questions = restored.questions || ['']
    const metadata = questions.map(() => ({}))
    const available = new Map()
    questions.forEach((text, index) => available.set(text, [...(available.get(text) || []), index]))
    let pendingTopics = []
    ;(previous.questions || []).forEach((text, index) => {
      const original = previous._questionMetadata?.[index] || {}
      pendingTopics.push(...(original.topicMarkers || []))
      const match = available.get(text)?.shift()
      if (match === undefined) return
      metadata[match] = { ...original, topicMarkers: pendingTopics }
      pendingTopics = []
    })
    result[key] = {
      ...restored,
      questions,
      _questionMetadata: metadata,
      _trailingTopicMarkers: [...pendingTopics, ...(previous._trailingTopicMarkers || [])],
    }
  }
  return result
}
