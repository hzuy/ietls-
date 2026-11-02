import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { showAlert } from '../utils/alertUtils'
import { PASSWORD_CHANGED_MESSAGE, passwordErrorMessage, validatePasswordChange } from '../utils/passwordUtils'

export function usePasswordChange(requestChange, resetForm) {
  const { handleLogout } = useAuth()
  const busy = useRef(false)
  const [saving, setSaving] = useState(false)

  async function submit(currentPassword, newPassword, confirmation) {
    if (busy.current) return
    const validation = validatePasswordChange(currentPassword, newPassword, confirmation)
    if (validation) {
      showAlert.error(validation)
      return
    }
    busy.current = true
    setSaving(true)
    try {
      await requestChange(currentPassword, newPassword)
    } catch (err) {
      const message = passwordErrorMessage(err)
      showAlert.error(message)
      if (err.response?.data?.code === 'PASSWORD_CHANGE_CONFLICT') handleLogout()
      return
    } finally {
      busy.current = false
      setSaving(false)
    }
    resetForm()
    showAlert.success(PASSWORD_CHANGED_MESSAGE)
    handleLogout()
  }

  return { submit, saving }
}
