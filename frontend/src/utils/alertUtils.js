/**
 * Unified Alert Utility
 * Chuyển đổi thông báo phản hồi (thành công, cảnh báo, lỗi, kết quả submit...) sang popup alert() của trình duyệt.
 *
 * @param {string|object} message - Nội dung thông báo hoặc đối tượng lỗi (Error, AxiosError)
 * @param {'info' | 'success' | 'error' | 'warning'} [type='info'] - Phân loại thông báo
 */
export const showAlert = (message, _type = 'info') => {
  if (typeof window === 'undefined' || !message) return

  let text = ''
  if (typeof message === 'string') {
    text = message
  } else if (typeof message === 'object') {
    text = message.response?.data?.message || message.message || JSON.stringify(message)
  } else {
    text = String(message)
  }

  if (typeof window.alert === 'function') {
    window.alert(text)
  }
}

showAlert.success = (msg) => showAlert(msg, 'success')
showAlert.error = (msg) => showAlert(msg, 'error')
showAlert.warning = (msg) => showAlert(msg, 'warning')
showAlert.info = (msg) => showAlert(msg, 'info')

export default showAlert
