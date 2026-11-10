// Task names are persisted independently of their shared answer mechanics.
export const GROUP_TYPE_ALIASES = {
  form_completion: 'note_completion',
  summary_completion: 'note_completion',
  flow_chart_completion: 'note_completion',
  sentence_completion: 'short_answer',
  matching_endings: 'matching_drag',
  categorisation: 'matching_drag',
  choose_title: 'mcq',
  list_selection: 'mcq_multi',
}
export const questionMechanic = type => Object.hasOwn(GROUP_TYPE_ALIASES, type) ? GROUP_TYPE_ALIASES[type] : type
export const TEXT_COMPLETION_TYPES = ['note_completion', 'form_completion', 'summary_completion', 'flow_chart_completion']
export const TOKEN_TYPES = [...TEXT_COMPLETION_TYPES, 'table_completion', 'drag_word_bank', 'diagram_label']
export const isMultiChoice = type => questionMechanic(type) === 'mcq_multi'

const shared = [
  { value: 'mcq', label: 'Multiple Choice (1 đáp án)' },
  { value: 'mcq_multi', label: 'Multiple Choice (nhiều đáp án)' },
  { value: 'note_completion', label: 'Note Completion' },
  { value: 'table_completion', label: 'Table Completion' },
  { value: 'flow_chart_completion', label: 'Flow-chart Completion' },
  { value: 'summary_completion', label: 'Summary Completion (điền từ)' },
  { value: 'sentence_completion', label: 'Sentence Completion' },
  { value: 'short_answer', label: 'Short-answer Questions' },
  { value: 'diagram_label', label: 'Diagram Label Completion' },
  { value: 'drag_word_bank', label: 'Summary Completion (word bank)' },
]
export const READING_GROUP_TYPES = [
  { value: 'true_false_ng', label: 'True / False / Not Given' },
  { value: 'yes_no_ng', label: 'Yes / No / Not Given' },
  ...shared,
  { value: 'matching_headings', label: 'Matching Headings' },
  { value: 'matching_information', label: 'Matching Information' },
  { value: 'matching_drag', label: 'Matching Features' },
  { value: 'matching_endings', label: 'Matching Sentence Endings' },
  { value: 'list_selection', label: 'List Selection' },
  { value: 'choose_title', label: 'Choose a Title' },
  { value: 'categorisation', label: 'Categorisation' },
]
export const LISTENING_GROUP_TYPES = [
  ...shared,
  { value: 'form_completion', label: 'Form Completion' },
  { value: 'matching', label: 'Matching' },
  { value: 'map_diagram', label: 'Plan / Map / Diagram Labelling' },
  { value: 'matching_drag', label: 'Matching (kéo thả)' },
  { value: 'matching_headings', label: 'Matching Headings' },
]
// Preserve the existing learner filter API, now sourced from the same catalog.
export const questionTypes = [...new Set([...READING_GROUP_TYPES, ...LISTENING_GROUP_TYPES].map(t => t.value))].map(key => ({
  key,
  label: [...READING_GROUP_TYPES, ...LISTENING_GROUP_TYPES].find(t => t.value === key).label,
  skills: [
    ...(READING_GROUP_TYPES.some(t => t.value === key) ? ['reading'] : []),
    ...(LISTENING_GROUP_TYPES.some(t => t.value === key) ? ['listening'] : []),
  ],
}))
export const getTypesBySkill = skill => questionTypes.filter(t => t.skills.includes(skill))
export const TASK_INSTRUCTIONS = {
  form_completion: 'Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.',
  summary_completion: 'Complete the summary below. Write NO MORE THAN TWO WORDS for each answer.',
  flow_chart_completion: 'Complete the flow-chart below. Write NO MORE THAN TWO WORDS for each answer.',
  sentence_completion: 'Complete the sentences below. Write NO MORE THAN TWO WORDS for each answer.',
  short_answer: 'Answer the questions below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.',
  matching_endings: 'Complete each sentence with the correct ending, A–F, below.',
  categorisation: 'Classify the following statements using the categories below. You may use any letter more than once.',
  choose_title: 'Choose the best title for the whole passage.',
  list_selection: 'Choose TWO letters, A–E.',
  matching_headings: 'Choose the correct heading for each paragraph from the list of headings below.',
}
export const NEUTRAL_GROUP_THEME = {
  cardBg: 'bg-white', cardBorder: 'border-zinc-200',
  headerBg: 'bg-zinc-50 border-zinc-200',
  badge: 'bg-white text-zinc-800 border-zinc-200',
  subBoxBg: 'bg-zinc-50', subBoxBorder: 'border-zinc-200',
  subBoxText: 'text-zinc-700', subBoxHover: 'hover:bg-zinc-100',
  subBoxBtn: 'bg-white text-zinc-800 border-zinc-300', accentColor: 'accent-zinc-900',
}

export function questionGroupTheme(type) {
  const mechanic = questionMechanic(type || '')
  let headerBg = 'bg-slate-100 border-slate-300'
  let badge = 'bg-slate-200 text-slate-900 border-slate-300'
  if (['note_completion', 'table_completion', 'short_answer', 'drag_word_bank', 'fill_blank'].includes(mechanic)) {
    headerBg = 'bg-amber-100/70 border-amber-200'
    badge = 'bg-amber-200/70 text-amber-950 border-amber-300'
  } else if (mechanic.startsWith('matching')) {
    headerBg = 'bg-sky-100/80 border-sky-200'
    badge = 'bg-sky-200/70 text-sky-950 border-sky-300'
  } else if (['true_false_ng', 'yes_no_ng'].includes(mechanic)) {
    headerBg = 'bg-violet-100/70 border-violet-200'
    badge = 'bg-violet-200/70 text-violet-950 border-violet-300'
  } else if (['diagram_label', 'map_diagram', 'diagram_completion'].includes(mechanic)) {
    headerBg = 'bg-teal-100/70 border-teal-200'
    badge = 'bg-teal-200/70 text-teal-950 border-teal-300'
  }
  return { ...NEUTRAL_GROUP_THEME, headerBg, badge }
}

// Accept both API and editor option/line shapes. Stable question IDs are
// necessary because learner renderers address Reading/Test answers by ID.
export function toLearnerGroup(group) {
  return {
    ...group,
    matchingOptions: (group.matchingOptions || []).map((o, i) => ({
      ...o, id: o.id ?? `option-${i}`, optionLetter: o.optionLetter ?? o.letter,
      optionText: o.optionText ?? o.text, letter: o.letter ?? o.optionLetter, text: o.text ?? o.optionText,
    })),
    noteSections: (group.noteSections || []).map((s, si) => ({ ...s, id: s.id ?? `section-${si}`, lines: (s.lines || []).map((l, li) => ({
      ...l, id: l.id ?? `line-${si}-${li}`, content: l.content ?? l.contentWithTokens ?? '', contentWithTokens: l.contentWithTokens ?? l.content ?? '',
    })) })),
    questions: (group.questions || []).map(q => ({ ...q, id: q.id ?? q.number })),
  }
}
