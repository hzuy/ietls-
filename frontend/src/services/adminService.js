import api from '../utils/axios'

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getAdminDashboard = () => api.get('/admin/dashboard').then(r => r.data)
export const getAdminAnalytics = (period) => api.get('/admin/analytics', { params: { period } }).then(r => r.data)

// ─── Users ────────────────────────────────────────────────────────────────────
export const getAdminUsers = (params) => api.get('/admin/users', { params }).then(r => r.data)
export const getAdminUser = (id) => api.get(`/admin/users/${id}`).then(r => r.data)
export const toggleUserLock = (userId) => api.put(`/admin/users/${userId}/toggle-lock`).then(r => r.data)
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`).then(r => r.data)
export const resetUserPassword = (id) => api.post(`/admin/users/${id}/reset-password`).then(r => r.data)

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
export const changeAdminPassword = (currentPassword, newPassword) =>
  api.put('/admin/me/password', { currentPassword, newPassword }).then(r => r.data)

// ─── Settings ────────────────────────────────────────────────────────────────
// In-memory cache — TTL 5 phút, tránh gọi API trùng lặp ở nhiều nơi (App, ReadingExam, ListeningExam, WritingExam, Settings)
let _settingsCache = null        // { data, ts }
let _settingsPending = null      // Promise đang chờ (chống stampede)
const SETTINGS_TTL = 5 * 60 * 1000 // 5 phút

export const getAdminSettings = async () => {
  const now = Date.now()
  // Trả cache nếu còn tươi
  if (_settingsCache && (now - _settingsCache.ts < SETTINGS_TTL)) {
    return _settingsCache.data
  }
  // Dedup: nếu đang có request chờ, chờ chung
  if (_settingsPending) return _settingsPending
  _settingsPending = api.get('/admin/settings')
    .then(r => {
      _settingsCache = { data: r.data, ts: Date.now() }
      return r.data
    })
    .finally(() => { _settingsPending = null })
  return _settingsPending
}

export const updateAdminSettings = (settings) =>
  api.put('/admin/settings', settings).then(r => {
    // Invalidate cache sau khi cập nhật
    _settingsCache = null
    return r.data
  })


// ─── Attempts ────────────────────────────────────────────────────────────────
export const getAdminAttempts = (params) => api.get('/admin/attempts', { params }).then(r => r.data)
export const getAdminAttemptsExport = (body) => api.post('/admin/attempts/export', body, { responseType: 'blob' })
export const getAdminExamSeriesForFilter = () => api.get('/admin/exam-series').then(r => r.data)


// ─── Trash ────────────────────────────────────────────────────────────────────
export const getAdminTrash = (page = 1, limit = 50) => api.get('/admin/trash', { params: { page, limit } }).then(r => r.data.items)
export const restoreTrashItem = (type, id) => api.post(`/admin/trash/${type}/${id}/restore`).then(r => r.data)
export const permanentDeleteTrashItem = (type, id) => api.delete(`/admin/trash/${type}/${id}/permanent`).then(r => r.data)
export const purgeTrash = () => api.delete('/admin/trash/purge').then(r => r.data)

// Sidebar badge count — cached in sessionStorage (TTL 5 phút) so route changes don't
// re-hit the API, but any trash-mutating action (restore / permanent delete / purge /
// soft-delete from another page) calls notifyTrashChanged() to drop the cache and
// push a fresh count to every mounted listener (AdminLayout) immediately.
const TRASH_COUNT_KEY = '__trashCount__'
const TRASH_COUNT_TTL = 5 * 60 * 1000
const _trashCountListeners = new Set()

export const getTrashCount = async ({ force = false } = {}) => {
  if (!force) {
    try {
      const cached = sessionStorage.getItem(TRASH_COUNT_KEY)
      if (cached) {
        const { count, ts } = JSON.parse(cached)
        if (Date.now() - ts < TRASH_COUNT_TTL) return count
      }
    } catch { /* ignore malformed / unavailable storage */ }
  }
  const count = await api.get('/admin/trash/count').then(r => r.data.count)
  try {
    sessionStorage.setItem(TRASH_COUNT_KEY, JSON.stringify({ count, ts: Date.now() }))
  } catch { /* ignore */ }
  return count
}

// Subscribe to "trash changed" pings. Returns an unsubscribe fn.
export const onTrashChanged = (fn) => {
  _trashCountListeners.add(fn)
  return () => { _trashCountListeners.delete(fn) }
}

// Call after any action that adds/removes trash items. Invalidates the cached count
// and notifies listeners so they can refetch.
export const notifyTrashChanged = () => {
  try { sessionStorage.removeItem(TRASH_COUNT_KEY) } catch { /* ignore */ }
  _trashCountListeners.forEach(fn => { try { fn() } catch { /* listener error must not break others */ } })
}
