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

function gradingParams(model) {
  const params = { response_format: { type: 'json_object' } }
  if (/gpt-oss/i.test(model)) params.reasoning_effort = process.env.GROQ_REASONING_EFFORT || 'low'
  return params
}

async function requestGradingJson(prompt, { attempts = 2 } = {}) {
  const { repairTruncatedJson } = require('../services/json/jsonSanitizer')
  const groq = getGroqClient()
  const model = getGroqModel()
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model,
        temperature: 0.3,
        ...gradingParams(model),
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

module.exports = { getGroqClient, getGroqModel, gradingParams, requestGradingJson }
