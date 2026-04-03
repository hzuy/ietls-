import api from '../utils/axios'

// ─── Exam Series ──────────────────────────────────────────────────────────────
export const getExamSeries = () => api.get('/admin/exam-series').then(r => r.data)
export const createExamSeries = (name) => api.post('/admin/exam-series', { name }).then(r => r.data)
export const updateExamSeries = (id, name) => api.put(`/admin/exam-series/${id}`, { name }).then(r => r.data)
export const deleteExamSeries = (id) => api.delete(`/admin/exam-series/${id}`).then(r => r.data)

// ─── Books (within series) ────────────────────────────────────────────────────
export const getSeriesBooks = (seriesId) => api.get(`/admin/exam-series/${seriesId}/books`).then(r => r.data)
export const addSeriesBook = (seriesId) => api.post(`/admin/exam-series/${seriesId}/books`).then(r => r.data)
export const deleteSeriesBook = (seriesId, bookNumber) => api.delete(`/admin/exam-series/${seriesId}/books/${bookNumber}`).then(r => r.data)
export const updateSeriesBookNumber = (seriesId, bookNumber, newNumber) =>
  api.put(`/admin/exam-series/${seriesId}/books/${bookNumber}`, { bookNumber: newNumber }).then(r => r.data)
export const uploadSeriesCover = (seriesId, bookNumber, formData) =>
  api.post(`/admin/exam-series/${seriesId}/covers/${bookNumber}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

// ─── Exams ────────────────────────────────────────────────────────────────────
export const getExams = () => api.get('/admin/exams').then(r => r.data)
export const getExam = (id) => api.get(`/admin/exams/${id}`).then(r => r.data)
export const createReadingExam = (payload) => api.post('/admin/exams/reading', payload).then(r => r.data)
export const createListeningExam = (payload) => api.post('/admin/exams/listening', payload).then(r => r.data)
export const createWritingExam = (payload) => api.post('/admin/exams/writing', payload).then(r => r.data)
export const createSpeakingExam = (payload) => api.post('/admin/exams/speaking', payload).then(r => r.data)
export const updateExam = (id, payload) => api.put(`/admin/exams/${id}`, payload).then(r => r.data)
export const deleteExam = (id) => api.delete(`/admin/exams/${id}`).then(r => r.data)

// ─── Exam Assets ──────────────────────────────────────────────────────────────
export const uploadImage = (formData) =>
  api.post('/admin/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
export const uploadAudio = (formData) =>
  api.post('/admin/upload-audio', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
export const transcribeAudio = (audioUrl) =>
  api.post('/admin/transcribe', { audioUrl }).then(r => r.data)

// ─── Cambridge PDF Upload ─────────────────────────────────────────────────────
export const uploadCambridgePdf = (formData, onUploadProgress) =>
  api.post('/admin/cambridge/upload-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }).then(r => r.data)
export const extractAndSaveCambridge = (payload) =>
  api.post('/admin/cambridge/extract-save', payload).then(r => r.data)

// ─── Exam List (public-facing) ────────────────────────────────────────────────
export const getReadingExams = () => api.get('/reading/exams').then(r => r.data)
export const getListeningExams = () => api.get('/listening/exams').then(r => r.data)
export const getWritingExams = () => api.get('/writing/exams').then(r => r.data)
export const getSpeakingExams = () => api.get('/speaking/exams').then(r => r.data)

export const getReadingExam = (id) => api.get(`/reading/exams/${id}`).then(r => r.data)
export const getListeningExam = (id) => api.get(`/listening/exams/${id}`).then(r => r.data)
export const getWritingExam = (id) => api.get(`/writing/exams/${id}`).then(r => r.data)
export const getSpeakingExam = (id) => api.get(`/speaking/exams/${id}`).then(r => r.data)

export const submitReadingExam = (id, answers) => api.post(`/reading/exams/${id}/submit`, { answers }).then(r => r.data)
export const submitListeningExam = (id, answers) => api.post(`/listening/exams/${id}/submit`, { answers }).then(r => r.data)
export const submitWritingExam = (id, taskId, essay) => api.post(`/writing/exams/${id}/submit`, { taskId, essay }).then(r => r.data)
export const submitSpeakingExam = (id, partId, transcript) => api.post(`/speaking/exams/${id}/submit`, { partId, transcript }).then(r => r.data)

export const getFullTestStatus = (examId) => api.get(`/full-test/status?examId=${examId}`).then(r => r.data)
export const getFullTestResult = (seriesId, bookNumber, testNumber) =>
  api.get(`/full-test/result?seriesId=${seriesId}&bookNumber=${bookNumber}&testNumber=${testNumber}`).then(r => r.data)
