import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 phút: chuyển qua lại giữa các tab không gọi lại API
      gcTime: 1000 * 60 * 30,    // 30 phút giữ trong cache bộ nhớ
      refetchOnWindowFocus: false, // tránh reload khi chuyển tab trình duyệt
      retry: 1,
    },
  },
})
