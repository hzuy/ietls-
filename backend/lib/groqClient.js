'use strict'
const Groq = require('groq-sdk')

/**
 * Lazy Groq client factory.
 *
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

async function requestGradingJson(prompt, { attempts = 2, image = null, model = null, temperature = 0.1, max_tokens = 4096 } = {}) {
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

module.exports = { getGroqClient, getGroqModel, getGroqVisionModel, gradingParams, requestGradingJson }
