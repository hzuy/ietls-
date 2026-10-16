'use strict'
const Groq = require('groq-sdk')

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
async function requestGeminiJson(prompt, { image = null, model = null, temperature = 0.2, max_tokens = 4096 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const primaryModel = (model && model.startsWith('gemini-'))
    ? model
    : (process.env.GEMINI_MODEL || 'gemini-3.5-flash')
  const candidateModels = primaryModel === 'gemini-3.1-flash-lite'
    ? ['gemini-3.1-flash-lite', 'gemini-3.5-flash']
    : [primaryModel, 'gemini-3.1-flash-lite']

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

  let lastError
  for (const targetModel of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens: max_tokens,
          },
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        const error = new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`)
        error.status = res.status
        throw error
      }

      const data = await res.json()
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const { repairTruncatedJson } = require('../services/json/jsonSanitizer')
      const finishReason = data.candidates?.[0]?.finishReason || null
      return JSON.parse(repairTruncatedJson(rawText, finishReason))
    } catch (err) {
      lastError = err
      if (err.status === 503 || err.status === 429) {
        // Try candidate model
        continue
      }
      throw err
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

module.exports = {
  getGroqClient,
  getGroqModel,
  getGroqVisionModel,
  gradingParams,
  requestGradingJson,
  requestGeminiJson,
  requestGroqGradingJson,
}
