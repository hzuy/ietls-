import api from '../utils/axios'

// ─── Public series ────────────────────────────────────────────────────────────
export const getSeriesList = () => api.get('/series').then(r => r.data)
export const getSeriesProgress = (id) => api.get(`/series/${id}/progress`).then(r => r.data)

// ─── Admin series ─────────────────────────────────────────────────────────────
export const getAdminSeriesList = () => api.get('/series/admin/list').then(r => r.data)
export const getAdminExamsList = () => api.get('/series/admin/exams-list').then(r => r.data)
export const createSeries = (body) => api.post('/series/admin', body).then(r => r.data)
export const updateSeries = (id, body) => api.put(`/series/admin/${id}`, body).then(r => r.data)
export const deleteSeries = (id) => api.delete(`/series/admin/${id}`).then(r => r.data)
export const uploadSeriesThumbnail = (id, formData) =>
  api.post(`/series/admin/${id}/thumbnail`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ─── Admin exam series (Cambridge full-test books) ────────────────────────────
export const getAdminExamSeries = () => api.get('/admin/exam-series').then(r => r.data)
