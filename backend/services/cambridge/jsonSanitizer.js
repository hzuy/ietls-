// Clean markdown backticks from AI raw output
function cleanJsonRaw(content) {
  return (content || '').trim()
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

// Attempt to repair truncated JSON (finish_reason === 'length')
function repairTruncatedJson(raw, finishReason) {
  let cleaned = cleanJsonRaw(raw)

  if (finishReason === 'length' && cleaned) {
    // Try to close any open arrays/objects
    const opens = { '{': '}', '[': ']' }
    const stack = []
    let inString = false, escape = false
    for (const ch of cleaned) {
      if (escape) { escape = false; continue }
      if (ch === '\\' && inString) { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (!inString) {
        if (ch === '{' || ch === '[') stack.push(opens[ch])
        else if (ch === '}' || ch === ']') stack.pop()
      }
    }
    if (stack.length > 0) {
      // Remove trailing comma before closing
      cleaned = cleaned.replace(/,\s*$/, '')
      cleaned += stack.reverse().join('')
    }
  }

  return cleaned
}

module.exports = {
  cleanJsonRaw,
  repairTruncatedJson
}
