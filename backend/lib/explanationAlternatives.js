'use strict'

const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[.,:;)]+$/g, '').replace(/\s+/g, ' ')

function allowsAlternatives(family, pairs = []) {
  return family === 'TFNG' || (['MCQ', 'MATCHING', 'IMAGE'].includes(family) && pairs.filter(pair => String(pair.text || '').trim()).length > 1)
}

// Only genuine choices from the task may be discussed as rejected answers.
// Open questions must not acquire an invented answer bank from source words.
function normalizeAlternatives(distractors, { family, pairs = [], answer = '', type = '' } = {}) {
  if (!allowsAlternatives(family, pairs)) return []
  let choices = pairs
  if (family === 'TFNG') {
    choices = (/yes_no/.test(type) || /^(yes|no)$/i.test(answer) ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN'])
      .map(value => ({ letter: value, text: value }))
  }
  const resolve = value => {
    let normalized = normalize(value)
    if (family === 'TFNG') normalized = ({ t: 'true', f: 'false', y: 'yes', n: 'no', ng: 'not given', notgiven: 'not given' })[normalized] || normalized
    return choices.find(pair => normalized === normalize(pair.letter) || normalized === normalize(pair.text)
      || normalized === normalize(`${pair.letter}. ${pair.text}`))
  }
  const whole = resolve(answer)
  const tokens = whole ? [whole] : String(answer).split(/\s*(?:[,;/&+]|\band\b)\s*/i).flatMap(phrase => {
    const choice = resolve(phrase)
    if (choice) return [choice]
    return phrase.split(/\s+/).flatMap(value => {
      const item = resolve(value)
      if (item) return [item]
      return /^[A-Z]{2,6}$/.test(value) ? [...value].map(resolve).filter(Boolean) : []
    })
  })
  const correct = new Set(tokens.map(pair => normalize(pair.letter)))
  const seen = new Set()
  return (Array.isArray(distractors) ? distractors : []).filter(item => {
    const choice = resolve(item?.option)
    const key = normalize(choice?.letter)
    if (!choice || correct.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, family === 'TFNG' ? 2 : 4)
}

function alternativesInstruction(family, pairs = []) {
  return allowsAlternatives(family, pairs)
    ? '"distractors": chỉ giải thích các lựa chọn có thật trong đề, loại trừ đáp án đúng; không tự tạo lựa chọn.'
    : '"distractors" PHẢI là []; đây là câu trả lời tự điền, không có các lựa chọn còn lại. Không lấy từ trong bài làm phương án nhiễu.'
}

module.exports = { allowsAlternatives, normalizeAlternatives, alternativesInstruction }
