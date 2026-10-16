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
  queryFn: async () => {
    const data = await fetchJson(API_BASE + '/home')
    try {
      if (typeof window !== 'undefined' && data) {
        localStorage.setItem('__home_cache__', JSON.stringify(data))
      }
    } catch {}
    return data
  },
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
  return useQuery({
    ...homeQueryOptions,
    placeholderData: (prev) => {
      if (prev) return prev
      if (typeof window === 'undefined') return undefined
      try {
        const cached = localStorage.getItem('__home_cache__')
        if (cached) return JSON.parse(cached)
      } catch {}
      return undefined
    },
  })
}

export function useFullTests() {
  return useQuery(fullTestsQueryOptions)
}
