import axios from 'axios'

const api = axios.create({
  baseURL: 'https://ietls.onrender.com/api',
})

// Tự động gắn token vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api