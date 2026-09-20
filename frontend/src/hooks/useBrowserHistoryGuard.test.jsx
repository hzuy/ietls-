import { render, act, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBrowserHistoryGuard } from './useBrowserHistoryGuard'

function TestComponent({ enabled, onBeforeExit }) {
  const { showModal, stay, leave } = useBrowserHistoryGuard(enabled, onBeforeExit)
  return (
    <div>
      <span data-testid="modal-state">{showModal ? 'open' : 'closed'}</span>
      <button data-testid="stay-btn" onClick={stay}>Ở lại</button>
      <button data-testid="leave-btn" onClick={leave}>Thoát</button>
    </div>
  )
}

describe('useBrowserHistoryGuard', () => {
  let pushStateSpy
  let goSpy

  beforeEach(() => {
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

  it('bấm "Thoát" → đóng modal và gọi history.go(-2) để thoát trang', () => {
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
