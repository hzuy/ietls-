import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { useAIExitGuard } from './useAIExitGuard'

function GuardedPage({ onBlocked, active = true }) {
  useAIExitGuard({ active, onBlocked })
  return (
    <div>
      <span>trang đang sửa</span>
      <Link to="/admin/exams/listening">Listening tab</Link>
      <a href="/admin/reports" onClick={(e) => e.preventDefault()}>Báo lỗi đề thi</a>
      <a href="https://example.com" onClick={(e) => e.preventDefault()}>Trang ngoài</a>
    </div>
  )
}

function renderAt(path, props) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<GuardedPage {...props} />} />
        <Route path="/admin/exams/listening" element={<span>trang listening</span>} />
        <Route path="/admin/reports" element={<span>trang báo lỗi</span>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('useAIExitGuard', () => {
  it('chặn điều hướng khi AI đang chạy và chỉ đi khi người dùng xác nhận', () => {
    const onBlocked = vi.fn()
    renderAt('/admin/exams/reading', { onBlocked, active: true })

    fireEvent.click(screen.getByRole('link', { name: 'Listening tab' }))

    expect(onBlocked).toHaveBeenCalledTimes(1)
    // Chưa điều hướng
    expect(screen.getByText('trang đang sửa')).toBeInTheDocument()

    // Người dùng xác nhận → callback phát lại click để React Router điều hướng
    const proceed = onBlocked.mock.calls[0][0]
    act(() => proceed())
    expect(screen.getByText('trang listening')).toBeInTheDocument()
  })

  it('chặn cả link thường trong sidebar', () => {
    const onBlocked = vi.fn()
    renderAt('/admin/exams/reading', { onBlocked, active: true })

    fireEvent.click(screen.getByRole('link', { name: 'Báo lỗi đề thi' }))

    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(screen.getByText('trang đang sửa')).toBeInTheDocument()
  })

  it('không chặn khi AI không chạy', () => {
    const onBlocked = vi.fn()
    renderAt('/admin/exams/reading', { onBlocked, active: false })

    fireEvent.click(screen.getByRole('link', { name: 'Listening tab' }))

    expect(onBlocked).not.toHaveBeenCalled()
    expect(screen.getByText('trang listening')).toBeInTheDocument()
  })

  it('bỏ qua link ngoài và click có phím bổ trợ', () => {
    const onBlocked = vi.fn()
    // Chặn default action ở pha bubble (sau guard) để jsdom không thử điều hướng
    // thật khi ta cố tình cho click đi qua.
    const stopNavigation = (e) => e.preventDefault()
    window.addEventListener('click', stopNavigation)
    renderAt('/admin/exams/reading', { onBlocked, active: true })

    fireEvent.click(screen.getByRole('link', { name: 'Trang ngoài' }))
    fireEvent.click(screen.getByRole('link', { name: 'Listening tab' }), { ctrlKey: true })

    window.removeEventListener('click', stopNavigation)

    expect(onBlocked).not.toHaveBeenCalled()
  })
})
