import api from '../utils/axios'

// ─── Public samples ───────────────────────────────────────────────────────────
export const getSample = (skill, id) => api.get(`/samples/${skill}/${id}`).then(r => r.data)

// ─── Admin Writing Samples ────────────────────────────────────────────────────
export const getWritingSamples = () => api.get('/samples/admin/writing').then(r => r.data)
export const getWritingSample = (id) => api.get(`/samples/admin/writing/${id}`).then(r => r.data)
export const createWritingSample = (body) => api.post('/samples/admin/writing', body).then(r => r.data)
export const updateWritingSample = (id, body) => api.put(`/samples/admin/writing/${id}`, body).then(r => r.data)
export const deleteWritingSample = (id) => api.delete(`/samples/admin/writing/${id}`).then(r => r.data)
export const uploadWritingSampleThumbnail = (id, formData) =>
  api.post(`/samples/admin/writing/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ─── Admin Speaking Samples ───────────────────────────────────────────────────
export const getSpeakingSamples = () => api.get('/samples/admin/speaking').then(r => r.data)
export const getSpeakingSample = (id) => api.get(`/samples/admin/speaking/${id}`).then(r => r.data)
export const createSpeakingSample = (body) => api.post('/samples/admin/speaking', body).then(r => r.data)
export const updateSpeakingSample = (id, body) => api.put(`/samples/admin/speaking/${id}`, body).then(r => r.data)
export const deleteSpeakingSample = (id) => api.delete(`/samples/admin/speaking/${id}`).then(r => r.data)
export const uploadSpeakingSampleThumbnail = (id, formData) =>
  api.post(`/samples/admin/speaking/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
