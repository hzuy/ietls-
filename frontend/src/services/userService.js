import api from '../utils/axios'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email, password) => api.post('/auth/login', { email, password }).then(r => r.data)
export const register = (form) => api.post('/auth/register', form).then(r => r.data)
export const getMe = () => api.get('/auth/me').then(r => r.data)
export const updateProfile = (name) => api.put('/auth/profile', { name }).then(r => r.data)
export const changePassword = (oldPassword, newPassword) =>
  api.put('/auth/change-password', { oldPassword, newPassword }).then(r => r.data)

// ─── User stats & history ─────────────────────────────────────────────────────
export const getUserStats = () => api.get('/user/stats').then(r => r.data)
