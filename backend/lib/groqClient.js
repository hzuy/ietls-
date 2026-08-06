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

module.exports = { getGroqClient }
