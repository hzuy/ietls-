import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useExitGuard — cảnh báo trước khi người dùng rời một bài thi đang làm dở.
 *
 * Chặn 2 hướng thoát:
 *   1. beforeunload — F5 / refresh, đóng tab, đóng cửa sổ → dialog gốc của trình duyệt.
 *   2. popstate     — nút Back / Forward của trình duyệt. Lúc bật guard, hook chèn
 *      một "sentinel" vào history (pushState, cùng URL). Lần Back đầu tiên sẽ "ăn"
 *      sentinel đó, popstate nổ ra, hook giữ người dùng ở lại và bật cờ `prompt`
 *      để nơi gọi hiển thị modal xác nhận.
 *
 * ⚠️ Hook này KHÔNG bắt được click <Link> hay navigate() trong app. Nó chỉ đủ an
 * toàn vì các trang thi (ReadingExam/ListeningExam/WritingExam/SpeakingExam và
 * PracticeExamPage) tự render <header> riêng, KHÔNG chứa <Navbar> / <Link> — App.jsx
 * cũng ẩn <Footer> trên các route này (FooterWrapper, regex
 * /^\/(reading|listening|writing|speaking)\/[^/]+/ và /^\/practice\/(reading|listening)\/[^/]+/).
 * Nên giữa bài KHÔNG có phần tử điều hướng nội bộ nào bấm được. Nếu sau này có ai
 * thêm link / nav vào các trang đó, đường điều hướng ấy PHẢI được guard riêng
 * (vd confirm trong onClick) — hook này không lo hộ được.
 *
 * 401-interceptor (utils/axios.js → window.location.href = '/') sẽ kích hoạt
 * beforeunload dialog giữa bài. Đây là hành vi đã biết, xử lý riêng ở P3-6.
 *
 * @param {boolean} enabled — bật/tắt guard; điều kiện kích hoạt do nơi gọi tự quyết.
 * @returns {{ prompt: boolean, stay: () => void, leave: () => void, disarm: () => Promise<void> }}
 *   prompt — true khi một lần Back/Forward đang bị giữ lại chờ xác nhận.
 *   stay   — người dùng chọn ở lại làm tiếp → đóng prompt, chèn lại sentinel.
 *   leave  — người dùng xác nhận thoát (từ prompt Back/Forward) → đóng prompt,
 *            thả điều hướng (history.back()).
 *   disarm — gọi TRƯỚC khi nơi gọi tự navigate() đi (nút ✕ xác nhận thoát, nộp
 *            bài thành công). "Ăn" nốt sentinel còn trong history để nó không nằm
 *            lại như một entry mồ côi, rồi resolve → nơi gọi navigate() tiếp.
 */
export function useExitGuard(enabled) {
  const [prompt, setPrompt] = useState(false)
  const armedRef = useRef(false)   // sentinel có đang nằm trong history không
  const bypassRef = useRef(false)  // bỏ qua đúng 1 popstate kế tiếp (do leave() gây ra)

  const arm = useCallback(() => {
    if (armedRef.current) return
    window.history.pushState(null, '', window.location.href)
    armedRef.current = true
  }, [])

  useEffect(() => {
    if (!enabled) return

    arm()

    const onPopState = () => {
      if (bypassRef.current) { bypassRef.current = false; return }
      armedRef.current = false   // sentinel vừa bị Back "ăn" mất
      setPrompt(true)
    }
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [enabled, arm])

  const stay = useCallback(() => {
    setPrompt(false)
    arm()   // no-op nếu sentinel vẫn còn (vd bấm ✕ rồi huỷ, không phải Back)
  }, [arm])

  const leave = useCallback(() => {
    setPrompt(false)
    bypassRef.current = true
    window.history.back()
  }, [])

  const disarm = useCallback(() => {
    setPrompt(false)
    if (!armedRef.current) return Promise.resolve()
    armedRef.current = false
    bypassRef.current = true
    return new Promise(resolve => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        bypassRef.current = false
        window.removeEventListener('popstate', finish)
        resolve()
      }
      window.addEventListener('popstate', finish)
      window.history.back()
      // Fallback: back() không đi đâu (vd sentinel là entry đầu của tab)
      setTimeout(finish, 200)
    })
  }, [])

  return { prompt, stay, leave, disarm }
}
