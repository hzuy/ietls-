import api from '../utils/axios'

/**
 * Send a chat message to the IELTS AI Tutor (Groq Llama 3.3)
 * @param {string} message - User message (max 500 chars)
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent conversation items
 * @returns {Promise<{reply: string}>}
 */
export const sendChatMessage = (message, conversationHistory = []) => {
  return api.post('/chatbot/chat', { message, conversationHistory }).then(r => r.data)
}
