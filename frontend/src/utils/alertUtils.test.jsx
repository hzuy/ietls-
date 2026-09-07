import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { showAlert } from './alertUtils'
import { ToastProvider, useToast } from '../context/ToastContext'

describe('alertUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.alert = vi.fn()
  })

  it('calls window.alert with string message', () => {
    showAlert('Thao tác thành công!')
    expect(window.alert).toHaveBeenCalledWith('Thao tác thành công!')
  })

  it('extracts error message from Axios error object', () => {
    const axiosError = {
      response: {
        data: {
          message: 'Dữ liệu không hợp lệ từ máy chủ',
        },
      },
    }
    showAlert(axiosError, 'error')
    expect(window.alert).toHaveBeenCalledWith('Dữ liệu không hợp lệ từ máy chủ')
  })

  it('extracts error message from standard Error object', () => {
    const err = new Error('Lỗi kết nối mạng')
    showAlert(err, 'error')
    expect(window.alert).toHaveBeenCalledWith('Lỗi kết nối mạng')
  })

  it('does nothing when message is empty or undefined', () => {
    showAlert('')
    showAlert(null)
    showAlert(undefined)
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('supports helper methods success, error, warning, info', () => {
    showAlert.success('Success message')
    expect(window.alert).toHaveBeenCalledWith('Success message')

    showAlert.error('Error message')
    expect(window.alert).toHaveBeenCalledWith('Error message')

    showAlert.warning('Warning message')
    expect(window.alert).toHaveBeenCalledWith('Warning message')

    showAlert.info('Info message')
    expect(window.alert).toHaveBeenCalledWith('Info message')
  })

  it('integrates with ToastContext so showToast triggers alert', () => {
    function TestConsumer() {
      const { showToast } = useToast()
      return (
        <button
          type="button"
          onClick={() => showToast('Toast to Alert', 'success')}
        >
          Kích hoạt
        </button>
      )
    }

    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    )

    act(() => {
      screen.getByText('Kích hoạt').click()
    })

    expect(window.alert).toHaveBeenCalledWith('Toast to Alert')
  })
})
