const { generateExaminerVoice } = require('./deepgramService')
const { uploadAudio } = require('./storageService')
const fs = require('fs')
const path = require('path')

/**
 * Generates TTS and uploads it, returning the URL.
 */
async function generateAndUploadTts(text, prefix) {
  if (!text) return null
  
  try {
    const buffer = await generateExaminerVoice(text)
    const tempFilename = `tts_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`
    
    // We assume backend/uploads/tmp exists or create it
    const tmpDir = path.join(__dirname, '../uploads/tmp')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    
    const tempPath = path.join(tmpDir, tempFilename)
    fs.writeFileSync(tempPath, buffer)
    
    const uploadResult = await uploadAudio({ path: tempPath, filename: tempFilename }, { subdir: 'speaking_tts', folder: 'speaking_tts' })
    return uploadResult.url
  } catch (err) {
    console.error(`TTS Generation failed for text: "${text.substring(0, 30)}..."`, err)
    return null
  }
}

/**
 * Mutates the speaking parts array in-place, generating TTS audio for missing audioUrls.
 * @param {Array} partsArray - Array of parts [part1, part2, part3]
 * @returns {Number} count of generated TTS
 */
async function processSpeakingTts(partsArray) {
  let ttsCount = 0;
  
  // Since TTS generation can take time, we can run them in parallel
  // but to avoid hitting rate limits, let's just do them sequentially or in small batches.
  // We'll do it sequentially for simplicity and safety.
  
  for (let pIndex = 0; pIndex < partsArray.length; pIndex++) {
    const part = partsArray[pIndex];
    if (!part) continue;
    
    // Process Intro TTS
    if (!part.introAudioUrl && part.introTtsScript) {
      const url = await generateAndUploadTts(part.introTtsScript, `intro_${pIndex + 1}`)
      if (url) {
        part.introAudioUrl = url
        ttsCount++
      }
    }
    
    // Process Questions TTS
    if (part.questions && Array.isArray(part.questions)) {
      for (let qIndex = 0; qIndex < part.questions.length; qIndex++) {
        let q = part.questions[qIndex]
        
        // Convert string questions to object so we can add audioUrl
        if (typeof q === 'string') {
          q = { questionText: q }
          part.questions[qIndex] = q
        }
        
        if (!q.audioUrl) {
          const textToSpeak = q.ttsScript || q.questionText
          if (textToSpeak) {
            const url = await generateAndUploadTts(textToSpeak, `q_${pIndex + 1}_${qIndex + 1}`)
            if (url) {
              q.audioUrl = url
              ttsCount++
            }
          }
        }
      }
    }
  }
  
  return ttsCount;
}

module.exports = { processSpeakingTts }
