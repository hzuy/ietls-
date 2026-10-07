const { DeepgramClient } = require('@deepgram/sdk')
const fs = require('fs')
const path = require('path')

async function transcribeAudio(audioPathOrUrl) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY không được cấu hình')
  }

  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY })
  const options = {
    model: 'nova-2',
    diarize: true,
    utterances: true,
    smart_format: true,
  }

  let result, error

  try {
    if (audioPathOrUrl.startsWith('http://') || audioPathOrUrl.startsWith('https://')) {
      const request = { url: audioPathOrUrl, ...options }
      const response = await deepgram.listen.v1.media.transcribeUrl(request)
      result = response.result || response.data || response
    } else {
      // Handle local file, e.g. /uploads/xxx.mp3 or absolute path C:\...
      let fullPath
      if (path.isAbsolute(audioPathOrUrl)) {
        fullPath = audioPathOrUrl
      } else {
        const cleanPath = audioPathOrUrl.startsWith('/') ? audioPathOrUrl.slice(1) : audioPathOrUrl
        fullPath = path.join(__dirname, '..', cleanPath)
      }
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Không tìm thấy file audio tại: ${fullPath}`)
      }
      
      const buffer = fs.readFileSync(fullPath)
      const response = await deepgram.listen.v1.media.transcribeFile(buffer, options)
      result = response.result || response.data || response
    }

    if (!result) throw new Error('Không có phản hồi từ Deepgram')

    const rawUtterances = result.results?.utterances || []
    if (rawUtterances.length === 0) return ''

    // Post-process: Merge consecutive short fragments from the same speaker
    // to form complete sentences instead of many small bubbles.
    const utterances = []
    let current = null

    for (const u of rawUtterances) {
      if (!current) {
        current = { ...u }
        continue
      }
      
      const gap = u.start - current.end
      const endsWithPunc = /[.?!]$/.test(current.transcript.trim())
      const isSameSpeaker = current.speaker === u.speaker
      
      // Start a new bubble if:
      // 1. Different speaker
      // 2. Same speaker, but previous sentence was complete (endsWithPunc)
      // 3. Same speaker, but pause is very long (> 3s)
      if (!isSameSpeaker || endsWithPunc || gap > 3.0) {
        utterances.push(current)
        current = { ...u }
      } else {
        // Merge with current to form a complete sentence
        current.end = u.end
        const t1 = current.transcript.trim()
        const t2 = u.transcript.trim()
        const needsSpace = t1 && t2 && !t1.endsWith('-')
        current.transcript = t1 + (needsSpace ? ' ' : '') + t2
      }
    }
    if (current) utterances.push(current)

    // Helper to format seconds to MM:SS
    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60)
      const s = Math.floor(seconds % 60)
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    // Convert to readable script format for Admin to easily edit
    const scriptLines = utterances.map(u => {
      let speakerName = 'Speaker A'
      if (u.speaker === 1) speakerName = 'Speaker B'
      if (u.speaker === 2) speakerName = 'Speaker C'
      if (u.speaker === 3) speakerName = 'Speaker D'
      
      return `[${formatTime(u.start)} - ${formatTime(u.end)}] ${speakerName}\n${u.transcript}`
    })

    return scriptLines.join('\n\n')
  } catch (err) {
    throw err
  }
}

// Helper function to read stream into buffer
const getAudioBuffer = async (stream) => {
  const reader = stream.getReader()
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const dataArray = chunks.reduce(
    (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
    new Uint8Array(0)
  )
  return Buffer.from(dataArray.buffer)
}

/**
 * Sinh giọng nói giám khảo từ văn bản text.
 * Trả về Buffer của file audio.
 */
async function generateExaminerVoice(text) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY không được cấu hình')
  }

  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY })

  try {
    const response = await deepgram.speak.request(
      { text },
      { model: 'aura-asteria-en' }
    )

    const stream = await response.getStream()
    if (!stream) {
      throw new Error('Không có stream trả về từ Deepgram TTS')
    }

    const buffer = await getAudioBuffer(stream)
    return buffer
  } catch (err) {
    console.error('Deepgram TTS Error:', err)
    throw err
  }
}

module.exports = {
  transcribeAudio,
  generateExaminerVoice
}
