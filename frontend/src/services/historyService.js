import api from '../utils/axios'

// GET /api/user/history — lịch sử làm bài Reading/Listening của user đang đăng nhập
export const getMyHistory = (params) => api.get('/user/history', { params }).then(r => r.data)
