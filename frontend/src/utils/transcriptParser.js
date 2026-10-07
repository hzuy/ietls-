export function parseTranscript(text) {
  if (!text) return { isScript: false, blocks: [] }

  const blocks = []
  const parts = text.split('\n\n')
  let isScript = false
  const uniqueSpeakers = new Set()

  for (const part of parts) {
    if (!part.trim()) continue
    const lines = part.trim().split('\n')
    
    // Check if the first line matches the script format: [00:00 - 00:05] Speaker Name
    if (lines.length >= 2) {
      const headerMatch = lines[0].match(/^\[(\d{2}:\d{2}) - (\d{2}:\d{2})\]\s+(.+)$/)
      if (headerMatch) {
        isScript = true
        
        const startStr = headerMatch[1]
        const endStr = headerMatch[2]
        const speaker = headerMatch[3].trim()
        
        const start = parseTime(startStr)
        const end = parseTime(endStr)
        const content = lines.slice(1).join('\n')
        
        uniqueSpeakers.add(speaker)
        blocks.push({
          startStr,
          endStr,
          start,
          end,
          speaker,
          text: content
        })
        continue
      }
    }
    
    // If it doesn't match the script format, treat it as plain text block
    blocks.push({
      start: 0,
      end: 0,
      speaker: '',
      text: part.trim()
    })
  }

  // If there's only 1 speaker throughout the script, treat it as a single-speaker text (paragraphs mode)
  if (uniqueSpeakers.size <= 1) {
    // But keep the timestamps if they exist, to allow auto-scrolling
    // The UI will just render it as paragraphs instead of chat bubbles
  }

  return { isScript, blocks, speakerCount: uniqueSpeakers.size }
}

function parseTime(str) {
  const [m, s] = str.split(':').map(Number)
  return m * 60 + s
}
