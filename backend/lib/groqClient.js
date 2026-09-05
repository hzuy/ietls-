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

module.exports = { getGroqClient, getGroqModel }
