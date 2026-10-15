import { useQuery } from '@tanstack/react-query'
import { API_BASE, BACKEND_URL } from '../utils/media'

const FIVE_MINUTES = 1000 * 60 * 5

async function fetchJson(url, init) {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export const homeQueryOptions = {
  queryKey: ['home'],
  queryFn: () => fetchJson(API_BASE + '/home'),
  staleTime: FIVE_MINUTES,
}

export const fullTestsQueryOptions = {
  queryKey: ['fullTests'],
  queryFn: () => fetchJson(`${BACKEND_URL}/api/admin/full-tests`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }),
  staleTime: FIVE_MINUTES,
}

export function useHomeData() {
  return useQuery(homeQueryOptions)
}

export function useFullTests() {
  return useQuery(fullTestsQueryOptions)
}
