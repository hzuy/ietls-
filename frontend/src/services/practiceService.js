import api from '../utils/axios'

// ─── Reading Practice ─────────────────────────────────────────────────────────
export const getReadingPracticeList = () => api.get('/practice/admin/reading').then(r => r.data)
export const getReadingPractice = (id) => api.get(`/practice/admin/reading/${id}`).then(r => r.data)
export const createReadingPractice = (body) => api.post('/practice/admin/reading', body).then(r => r.data)
export const updateReadingPractice = (id, body) => api.put(`/practice/admin/reading/${id}`, body).then(r => r.data)
export const deleteReadingPractice = (id) => api.delete(`/practice/admin/reading/${id}`).then(r => r.data)
export const uploadReadingThumbnail = (id, formData) =>
  api.post(`/practice/admin/reading/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ─── Listening Practice ───────────────────────────────────────────────────────
export const getListeningPracticeList = () => api.get('/practice/admin/listening').then(r => r.data)
export const getListeningPractice = (id) => api.get(`/practice/admin/listening/${id}`).then(r => r.data)
export const createListeningPractice = (body) => api.post('/practice/admin/listening', body).then(r => r.data)
export const updateListeningPractice = (id, body) => api.put(`/practice/admin/listening/${id}`, body).then(r => r.data)
export const deleteListeningPractice = (id) => api.delete(`/practice/admin/listening/${id}`).then(r => r.data)
export const uploadListeningThumbnail = (id, formData) =>
  api.post(`/practice/admin/listening/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
export const uploadListeningAudio = (id, formData) =>
  api.post(`/practice/admin/listening/${id}/audio`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ─── Practice (public-facing) ─────────────────────────────────────────────────
export const getPractice = (skill, id) => api.get(`/practice/${skill}/${id}`).then(r => r.data)
