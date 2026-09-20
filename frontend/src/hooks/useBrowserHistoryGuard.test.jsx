import { render, act, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBrowserHistoryGuard } from './useBrowserHistoryGuard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

function TestComponent({ enabled, onBeforeExit, defaultFallbackPath, targetPath }) {
  const { showModal, stay, leave } = useBrowserHistoryGuard(enabled, onBeforeExit, defaultFallbackPath)
  return (
    <div>
      <span data-testid="modal-state">{showModal ? 'open' : 'closed'}</span>
      <button data-testid="stay-btn" onClick={stay}>Ở lại</button>
      <button data-testid="leave-btn" onClick={() => leave(targetPath)}>Thoát</button>
    </div>
  )
}

describe('useBrowserHistoryGuard', () => {
  let pushStateSpy
  let goSpy

  beforeEach(() => {
    mockNavigate.mockClear()
    Object.defineProperty(window.history, 'length', { value: 5, configurable: true, writable: true })
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
    goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('không đẩy history state hay gán listener khi enabled=false', () => {
    render(<TestComponent enabled={false} />)
    expect(pushStateSpy).not.toHaveBeenCalled()
  })

  it('đẩy history state dự phòng khi enabled=true', () => {
    render(<TestComponent enabled={true} />)
    expect(pushStateSpy).toHaveBeenCalledTimes(1)
  })

  it('modal ở trạng thái đóng khi mới mount', () => {
    render(<TestComponent enabled={true} />)
    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
  })

  it('khi người dùng bấm Back → mở modal và gọi onBeforeExit', () => {
    const onBeforeExit = vi.fn()
    render(<TestComponent enabled={true} onBeforeExit={onBeforeExit} />)

    // Trigger popstate event (mô phỏng nút Back)
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(onBeforeExit).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('modal-state').textContent).toBe('open')
    // sentinel được chèn lại khi Back: 1 lần mount + 1 lần trong handler
    expect(pushStateSpy).toHaveBeenCalledTimes(2)
  })

  it('bấm "Ở lại" → đóng modal, KHÔNG navigate', () => {
    render(<TestComponent enabled={true} />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('modal-state').textContent).toBe('open')

    act(() => {
      screen.getByTestId('stay-btn').click()
    })

    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    expect(goSpy).not.toHaveBeenCalled()
  })

  it('bấm "Thoát" khi history.length > 2 và không có targetPath → đóng modal và gọi history.go(-2)', () => {
    const onBeforeExit = vi.fn()
    render(<TestComponent enabled={true} onBeforeExit={onBeforeExit} />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    act(() => {
      screen.getByTestId('leave-btn').click()
    })

    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    expect(goSpy).toHaveBeenCalledWith(-2)
    // onBeforeExit được gọi ít nhất 1 lần (lúc popstate và lúc leave)
    expect(onBeforeExit).toHaveBeenCalled()
  })

  it('khi history.length <= 2 và có fallbackUrl → gọi navigate(fallbackUrl, { replace: true }) và không gọi history.go', () => {
    Object.defineProperty(window.history, 'length', { value: 2, configurable: true, writable: true })
    const onBeforeExit = vi.fn()
    render(<TestComponent enabled={true} onBeforeExit={onBeforeExit} targetPath="/practice/reading" />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('modal-state').textContent).toBe('open')

    act(() => {
      screen.getByTestId('leave-btn').click()
    })

    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    expect(mockNavigate).toHaveBeenCalledWith('/practice/reading', { replace: true })
    expect(goSpy).not.toHaveBeenCalled()
    expect(onBeforeExit).toHaveBeenCalled()
  })

  it('khi history.length <= 2 và không có targetPath → navigate về fallback path an toàn', () => {
    Object.defineProperty(window.history, 'length', { value: 2, configurable: true, writable: true })
    render(<TestComponent enabled={true} defaultFallbackPath="/full-test/1?book=1" />)

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    act(() => {
      screen.getByTestId('leave-btn').click()
    })

    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    expect(mockNavigate).toHaveBeenCalledWith('/full-test/1?book=1', { replace: true })
    expect(goSpy).not.toHaveBeenCalled()
  })

  it('sau khi bấm "Thoát", sự kiện popstate tiếp diễn (do history.go kích hoạt) KHÔNG mở lại modal lần 2', () => {
    render(<TestComponent enabled={true} />)

    // 1. Thí sinh bấm nút Back lần đầu -> mở modal
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByTestId('modal-state').textContent).toBe('open')
    const pushCountBeforeLeave = pushStateSpy.mock.calls.length

    // 2. Thí sinh bấm "Thoát"
    act(() => {
      screen.getByTestId('leave-btn').click()
    })
    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    expect(goSpy).toHaveBeenCalledWith(-2)

    // 3. Trình duyệt phát sinh sự kiện popstate trong quá trình lùi history
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    // Modal PHẢI giữ nguyên trạng thái closed, TUYỆT ĐỐI không mở lại lần 2
    expect(screen.getByTestId('modal-state').textContent).toBe('closed')
    // Không đẩy thêm bất kỳ sentinel pushState nào
    expect(pushStateSpy).toHaveBeenCalledTimes(pushCountBeforeLeave)
  })
})

