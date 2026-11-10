// Persist before POST so a lost response and a page reload retry the same write.
const storageKey = (userId, examId, skill) => `ielts_submission_${userId}_${examId}_${skill}`

export function getSubmissionTicket(userId, examId, skill, answers) {
  const name = storageKey(userId, examId, skill)
  const saved = localStorage.getItem(name)
  if (saved) return JSON.parse(saved)
  const ticket = {key: crypto.randomUUID(), answers: structuredClone(answers)}
  localStorage.setItem(name, JSON.stringify(ticket))
  return ticket
}

export function clearSubmissionTicket(userId, examId, skill) {
  localStorage.removeItem(storageKey(userId, examId, skill))
}
