const judgmentTypes = new Set(['true_false_ng', 'yes_no_ng', 'true_false_not_given', 'yes_no_not_given'])
const openTypes = new Set(['fill_blank', 'short_answer', 'note_completion', 'form_completion', 'table_completion', 'sentence_completion', 'summary_completion', 'flow_chart_completion'])

function hasOptions(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return false }
  }
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' ? item.trim() : item?.text || item?.optionText || item?.label).length > 1
  return value && typeof value === 'object' && Object.values(value).filter(Boolean).length > 1
}

/** Alternatives belong to the question, never to words invented by the model. */
export function hasExplanationChoices(question = {}, group = question.group || {}) {
  const type = group.type || question.type || ''
  if (judgmentTypes.has(type)) return true
  if (openTypes.has(type)) return false
  return Boolean(hasOptions(question.options) || hasOptions(group.matchingOptions) || hasOptions(group.options))
}
