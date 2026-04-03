import api from '../utils/axios'

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getAdminDashboard = () => api.get('/admin/dashboard').then(r => r.data)
export const getAdminAnalytics = (period) => api.get('/admin/analytics', { params: { period } }).then(r => r.data)

// ─── Users ────────────────────────────────────────────────────────────────────
export const getAdminUsers = (params) => api.get('/admin/users', { params }).then(r => r.data)
export const getAdminUser = (id) => api.get(`/admin/users/${id}`).then(r => r.data)
export const toggleUserLock = (userId) => api.put(`/admin/users/${userId}/toggle-lock`).then(r => r.data)
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`).then(r => r.data)

// ─── Staff ────────────────────────────────────────────────────────────────────
export const getAdminStaff = () => api.get('/admin/staff').then(r => r.data)
export const makeAdmin = (userId) => api.post('/admin/make-admin', { userId }).then(r => r.data)
export const makeTeacher = (userId) => api.post('/admin/make-teacher', { userId }).then(r => r.data)
export const removeStaff = (userId) => api.post('/admin/remove-staff', { userId }).then(r => r.data)

// ─── Accounts ────────────────────────────────────────────────────────────────
export const getAdminAccounts = () => api.get('/admin/accounts').then(r => r.data)
export const createAdminAccount = (form) => api.post('/admin/accounts', form).then(r => r.data)
export const updateAdminAccount = (id, form) => api.put(`/admin/accounts/${id}`, form).then(r => r.data)
export const deleteAdminAccount = (id) => api.delete(`/admin/accounts/${id}`).then(r => r.data)

// ─── Profile (admin self) ─────────────────────────────────────────────────────
export const getAdminMe = () => api.get('/admin/me').then(r => r.data)
export const changeAdminPassword = (oldPassword, newPassword) =>
  api.put('/admin/me/password', { oldPassword, newPassword }).then(r => r.data)

// ─── Settings ────────────────────────────────────────────────────────────────
export const getAdminSettings = () => api.get('/admin/settings').then(r => r.data)
export const updateAdminSettings = (settings) => api.put('/admin/settings', settings).then(r => r.data)

// ─── Attempts ────────────────────────────────────────────────────────────────
export const getAdminAttempts = (params) => api.get('/admin/attempts', { params }).then(r => r.data)
export const getAdminExamSeriesForFilter = () => api.get('/admin/exam-series').then(r => r.data)

// ─── Trash ────────────────────────────────────────────────────────────────────
export const getAdminTrash = () => api.get('/admin/trash').then(r => r.data)
export const restoreTrashItem = (type, id) => api.post(`/admin/trash/${type}/${id}/restore`).then(r => r.data)
export const permanentDeleteTrashItem = (type, id) => api.delete(`/admin/trash/${type}/${id}/permanent`).then(r => r.data)
export const purgeTrash = () => api.delete('/admin/trash/purge').then(r => r.data)
export const getTrashCount = () => api.get('/admin/trash').then(r => r.data.length)
