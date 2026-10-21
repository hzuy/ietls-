'use strict'
const Groq = require('groq-sdk')
const {
  scheduleGeminiCall,
  parseGeminiRetryWaitMs,
  recordGeminiCooldown,
} = require('./geminiRateLimiter')

/**
 * Lazy Groq client factory.
 * Never instantiates Groq at module-load time, so importing this file
 * in test environments (where GROQ_API_KEY is not set) is safe.
 * Call getGroqClient() only inside request handlers or async functions.
 */
function getGroqClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

// Groq gỡ model cũ khá thường xuyên (vd. llama-3.3-70b-versatile bị gỡ 08/2026).
// Tập trung tên model text ở 1 chỗ — đổi qua GROQ_MODEL trong .env khi Groq gỡ model
// tiếp, không cần sửa lại từng route (writing/speaking/stats/chatbot).
function getGroqModel() {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
}

function getGroqVisionModel() {
  return process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b'
}

function gradingParams(model) {
  const params = { response_format: { type: 'json_object' } }
  if (/gpt-oss/i.test(model)) params.reasoning_effort = process.env.GROQ_REASONING_EFFORT || 'low'
  return params
}

/**
 * Request structured JSON from Google Gemini API (Primary AI provider).
 * High rate limits: 1,000,000 TPM and 1,500 RPD on free tier.
 */
async function requestGeminiJson(prompt, {
  image = null,
  model = null,
  temperature = 0,
  seed = null,
  responseSchema = null,
  thinkingConfig = null,
  max_tokens = 8192,
  withMetadata = false,
  retriesPerModel = 1,
  signal = null,
} = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const primaryModel = (model && model.startsWith('gemini-'))
    ? model
    : (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')
  const candidateModels = [
    primaryModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ].filter((v, i, a) => a.indexOf(v) === i)

  const parts = [{ text: prompt }]

  if (image) {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(image)
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      })
    } else if (/^https?:\/\//i.test(image)) {
      try {
        const imgRes = await fetch(image)
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
          const arrayBuffer = await imgRes.arrayBuffer()
          const b64 = Buffer.from(arrayBuffer).toString('base64')
          parts.push({
            inlineData: {
              mimeType: contentType,
              data: b64,
            },
          })
        }
      } catch (fetchErr) {
        console.warn('[Gemini] Không thể tải ảnh từ URL:', fetchErr.message)
      }
    }
  }

  const generationConfig = {
    responseMimeType: 'application/json',
    temperature,
    maxOutputTokens: max_tokens,
  }
  if (seed !== null && seed !== undefined) {
    generationConfig.seed = seed
  }

  if (responseSchema) {
    generationConfig.responseSchema = responseSchema
  }

  if (thinkingConfig) {
    generationConfig.thinkingConfig = thinkingConfig
  } else if ((primaryModel.includes('3.8-flash') || primaryModel.includes('3.5-flash')) && !primaryModel.includes('lite')) {
    generationConfig.thinkingConfig = { thinkingLevel: 'low' }
  }

  let lastError
  for (const targetModel of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`

    for (let attempt = 0; attempt <= retriesPerModel; attempt++) {
      if (signal?.aborted) {
        const err = new Error('Yêu cầu AI đã bị hủy')
        err.name = 'AbortError'
        throw err
      }
      try {
        const fetchSignals = [AbortSignal.timeout(22000)]
        if (signal) fetchSignals.push(signal)
        const combinedSignal = (typeof AbortSignal.any === 'function')
          ? AbortSignal.any(fetchSignals)
          : fetchSignals[0]

        const res = await scheduleGeminiCall(() =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig,
            }),
            signal: combinedSignal,
          }),
          { signal }
        )

        if (!res.ok) {
          const errText = await res.text()
          const error = new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`)
          error.status = res.status
          error.retryWaitMs = parseGeminiRetryWaitMs(res.headers, errText)
          throw error
        }

        const data = await res.json()
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const { repairTruncatedJson } = require('../services/json/jsonSanitizer')
        const finishReason = data.candidates?.[0]?.finishReason || null
        const parsed = JSON.parse(repairTruncatedJson(rawText, finishReason))

        if (withMetadata) {
          return {
            data: parsed,
            provider: 'Gemini',
            model: targetModel,
          }
        }
        return parsed
      } catch (err) {
        lastError = err
        if (signal?.aborted) throw err
        const isTransient = err.status === 503 || err.status === 429 || err instanceof SyntaxError
        if (isTransient && attempt < retriesPerModel) {
          const waitMs = err.retryWaitMs || ((attempt + 1) * 2500)
          recordGeminiCooldown(waitMs)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        break // Try next candidate model
      }
    }
  }
  throw lastError
}

/**
 * Request structured JSON from Groq API (Secondary / Fallback provider).
 */
async function requestGroqGradingJson(prompt, { attempts = 2, image = null, model = null, temperature = 0.1, max_tokens = 4096 } = {}) {
  const { repairTruncatedJson } = require('../services/json/jsonSanitizer')
  const groq = getGroqClient()
  const targetModel = model || (image ? getGroqVisionModel() : getGroqModel())
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const messages = image
        ? [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ]
        : [{ role: 'user', content: prompt }]

      const completion = await groq.chat.completions.create({
        messages,
        model: targetModel,
        temperature,
        max_tokens,
        ...gradingParams(targetModel),
      })
      const text = completion.choices[0]?.message?.content || ''
      return JSON.parse(repairTruncatedJson(text, completion.choices[0]?.finish_reason || null))
    } catch (err) {
      lastError = err
      if (!(err instanceof SyntaxError) && err?.status !== 400) throw err
    }
  }
  throw lastError
}

/**
 * Main AI entrypoint for grading & explanations.
 * Automatically uses Google Gemini as Primary and falls back to Groq if needed.
 */
async function requestGradingJson(prompt, options = {}) {
  const useGemini = process.env.GEMINI_API_KEY && (process.env.NODE_ENV !== 'test' || process.env.ENABLE_GEMINI_IN_TEST === 'true')
  if (useGemini) {
    try {
      return await requestGeminiJson(prompt, options)
    } catch (geminiErr) {
      console.warn(`[AI] Gemini gặp sự cố (${geminiErr.status || geminiErr.message}), tự động chuyển sang Groq dự phòng...`)
    }
  }
  return await requestGroqGradingJson(prompt, options)
}

/**
 * Request chat completion from Google Gemini API (Primary AI provider for chat).
 */
async function requestGeminiChat(messages, { model = null, temperature = 0.3, max_tokens = 1400 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const primaryModel = (model && model.startsWith('gemini-'))
    ? model
    : (process.env.GEMINI_MODEL || 'gemini-3.8-flash')
  const candidateModels = [
    primaryModel,
    'gemini-3.8-flash',
    'gemini-3.5-flash',
  ].filter((v, i, a) => a.indexOf(v) === i)

  const systemMessages = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map(m => m.content).join('\n\n') }] }
    : undefined

  const contents = conversationMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }))

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] })
  } else if (contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Context' }] })
  }

  let lastError
  for (const targetModel of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`
    try {
      const payload = {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: max_tokens,
        },
      }
      if (systemInstruction) payload.systemInstruction = systemInstruction

      const res = await scheduleGeminiCall(() =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        })
      )

      if (!res.ok) {
        const errText = await res.text()
        const error = new Error(`Gemini Chat API error (${res.status}): ${errText.slice(0, 300)}`)
        error.status = res.status
        error.retryWaitMs = parseGeminiRetryWaitMs(res.headers, errText)
        throw error
      }

      const data = await res.json()
      const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
      const finishReason = data.candidates?.[0]?.finishReason || null
      return { text, finishReason }
    } catch (err) {
      lastError = err
      if (err.status === 503 || err.status === 429) {
        continue
      }
      throw err
    }
  }
  throw lastError
}

/**
 * Request chat completion from Groq API (Secondary / Fallback provider for chat).
 */
async function requestGroqChat(messages, { model = null, temperature = 0.3, max_tokens = 1400 } = {}) {
  const groq = getGroqClient()
  if (!groq) throw new Error('GROQ_API_KEY is not configured')
  const targetModel = model || getGroqModel()
  const params = { messages, model: targetModel, temperature, max_tokens }
  if (/gpt-oss/i.test(targetModel)) params.reasoning_effort = 'low'
  const completion = await groq.chat.completions.create(params)
  const choice = completion.choices?.[0]
  return {
    text: (choice?.message?.content || '').trim(),
    finishReason: choice?.finish_reason || null,
  }
}

/**
 * Main AI entrypoint for multi-turn chat (used by chatbot).
 * Automatically uses Google Gemini as Primary and falls back to Groq if needed.
 */
async function requestAiChat(messages, options = {}) {
  const useGemini = process.env.GEMINI_API_KEY && (process.env.NODE_ENV !== 'test' || process.env.ENABLE_GEMINI_IN_TEST === 'true')
  if (useGemini) {
    try {
      return await requestGeminiChat(messages, options)
    } catch (geminiErr) {
      console.warn(`[AI Chat] Gemini gặp sự cố (${geminiErr.status || geminiErr.message}), tự động chuyển sang Groq dự phòng...`)
    }
  }
  return await requestGroqChat(messages, options)
}

module.exports = {
  getGroqClient,
  getGroqModel,
  getGroqVisionModel,
  gradingParams,
  requestGradingJson,
  requestGeminiJson,
  requestGroqGradingJson,
  requestGeminiChat,
  requestGroqChat,
  requestAiChat,
}
