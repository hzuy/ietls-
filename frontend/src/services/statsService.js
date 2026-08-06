import api from '../utils/axios'

export const getErrorBreakdown = (skill) =>
  api.get('/stats/error-breakdown', { params: { skill } }).then(r => r.data)

export const getTrendData = (skill) =>
  api.get('/stats/trend', { params: { skill } }).then(r => r.data)

export const getWritingCriteria = () =>
  api.get('/stats/writing-criteria').then(r => r.data)

export const getSpeakingCriteria = () =>
  api.get('/stats/speaking-criteria').then(r => r.data)

export const getAIAdvice = () =>
  api.post('/stats/advice').then(r => r.data)
