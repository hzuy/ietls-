import { useState, useEffect, useRef, useCallback } from 'react'

// A generation belongs only to this editor visit. Never restore a previous
// browser heartbeat or poll a previous server run on entry. The API still
// serializes actual concurrent writes with its server-side lock.
export function useExplanationGenerationLock({ examId, type = 'practice', enabled = true }) {
  const numericId = Number(examId)
  const target = enabled && numericId ? `${type}_${numericId}` : null
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [localProgress, setLocalProgress] = useState(null)
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const abortControllerRef = useRef(null)
  const pendingExitActionRef = useRef(null)

  useEffect(() => {
    setIsGenerating(false)
    setIsCancelling(false)
    setLocalProgress(null)
    setExitConfirmOpen(false)
    pendingExitActionRef.current = null
    if (target) {
      try {
        localStorage.removeItem(`ai_exp_active_${target}`)
        localStorage.removeItem(`ai_exp_evidence_${target}`)
      } catch { /* Legacy browser state may be unavailable. */ }
    }
    return () => {
      const controller = abortControllerRef.current
      abortControllerRef.current = null
      controller?.abort()
    }
  }, [target])

  const startLocalGeneration = useCallback(async ({ abortController, total = 0, current = 0 }) => {
    abortControllerRef.current = abortController
    setIsGenerating(true)
    setIsCancelling(false)
    setLocalProgress({ current, total })
  }, [])

  const endLocalGeneration = useCallback(() => {
    abortControllerRef.current = null
    setIsGenerating(false)
    setIsCancelling(false)
    setLocalProgress(null)
  }, [])

  const updateLocalProgress = useCallback(progress => setLocalProgress(progress), [])
  const notifyChunkStart = useCallback(() => {}, [])
  const notifyChunkEnd = useCallback(() => {}, [])

  useEffect(() => {
    if (!isGenerating) return
    const handleBeforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handlePageHide = () => abortControllerRef.current?.abort()
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [isGenerating])

  const openExitConfirm = useCallback(action => {
    pendingExitActionRef.current = action
    setExitConfirmOpen(true)
  }, [])
  const closeExitConfirm = useCallback(() => {
    pendingExitActionRef.current = null
    setExitConfirmOpen(false)
  }, [])
  const confirmExit = useCallback(() => {
    abortControllerRef.current?.abort()
    endLocalGeneration()
    setExitConfirmOpen(false)
    const action = pendingExitActionRef.current
    pendingExitActionRef.current = null
    action?.()
  }, [endLocalGeneration])
  const handleSafeActionOrExit = useCallback(action => {
    if (isGenerating) {
      openExitConfirm(action)
      return false
    }
    action?.()
    return true
  }, [isGenerating, openExitConfirm])

  const isLockedOperation = isGenerating || isCancelling
  return {
    isGenerating, setIsGenerating, isCancelling, setIsCancelling, localProgress,
    isLockedOperation, isLockedGenerate: isLockedOperation,
    lockTooltip: isCancelling ? 'Đang hủy tiến trình sinh AI...'
      : isGenerating ? 'Đang sinh giải thích AI, vui lòng chờ hoặc bấm Hủy' : null,
    resumeBanner: null,
    exitConfirmOpen, openExitConfirm, closeExitConfirm, confirmExit, handleSafeActionOrExit,
    startLocalGeneration, endLocalGeneration, updateLocalProgress, notifyChunkStart, notifyChunkEnd,
  }
}
