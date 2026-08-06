import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
})

// Tự động gắn token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Xử lý lỗi 401 (token hết hạn / không hợp lệ)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''

    // KHÔNG redirect khi lỗi xảy ra ở endpoint đăng nhập/đăng ký hoặc settings background
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    const isSettingsEndpoint = url.includes('/admin/settings')

    if (status === 401 && !isAuthEndpoint && !isSettingsEndpoint) {
      // Chỉ xóa token và redirect khi thực sự bị hết hạn session trên protected route
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('requirePasswordChange')

      if (window.location.pathname !== '/' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  }
)

export default api
