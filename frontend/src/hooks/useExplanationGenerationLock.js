import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api from '../utils/axios'

const BROADCAST_CHANNEL_NAME = 'ai_explanation_sync'
const LOCAL_STORAGE_ACTIVE_PREFIX = 'ai_exp_active_'
const LOCAL_STORAGE_RUN_EVIDENCE_PREFIX = 'ai_exp_evidence_'
const HEARTBEAT_EXPIRY_MS = 20000 // >= 15s per requirement (supports background tabs)
const GRACE_WINDOW_MS = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 50 : 5000 // 5s grace window on mount (50ms in test)

/**
 * Shared hook to manage AI explanation generation lifecycle, concurrency locks,
 * multi-tab synchronization, grace window detection, and exit prevention.
 *
 * Applicable across:
 * - Reading Practice
 * - Listening Practice
 * - Exam Reading
 * - Exam Listening
 */
export function useExplanationGenerationLock({
  examId,
  type = 'practice', // 'practice' | 'exam'
  skill = 'reading',  // 'reading' | 'listening'
  enabled = true,
  onResumeGenerate = null,
}) {
  const numericId = Number(examId)
  const isTargetValid = Boolean(enabled && numericId)

  // Local generation state in current tab
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [localProgress, setLocalProgress] = useState(null) // { current, total, label }

  // Other tabs in same browser state
  const [isBrowserRunning, setIsBrowserRunning] = useState(false)
  const [browserProgress, setBrowserProgress] = useState(null)

  // Server state
  const [isServerRunning, setIsServerRunning] = useState(false)
  const [serverStatus, setServerStatus] = useState(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Banner dismissed state
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Bộ đếm "bằng chứng chạy AI" (localStorage ai_exp_evidence_*). hasLocalEvidence
  // chỉ đọc localStorage một lần theo storageEvidenceKey, nên khi bằng chứng được
  // ghi/xóa ngay trong phiên hiện tại thì memo cũ vẫn còn (stale). Bộ đếm này được
  // tăng mỗi lần ghi/xóa để memo tính lại đúng.
  const [evidenceVersion, setEvidenceVersion] = useState(0)

  // Exit confirm modal state
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const pendingExitActionRef = useRef(null)
  const abortControllerRef = useRef(null)
  const webLockReleaseRef = useRef(null)
  const broadcastChannelRef = useRef(null)
  const tabIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2)
  )
  const isHoldingWebLockRef = useRef(false)
  const inspectedTargetRef = useRef(null)

  const lockKey = `${type}_${numericId}`
  const storageActiveKey = `${LOCAL_STORAGE_ACTIVE_PREFIX}${lockKey}`
  const storageEvidenceKey = `${LOCAL_STORAGE_RUN_EVIDENCE_PREFIX}${lockKey}`

  // ── 1. WEB LOCKS + LOCALSTORAGE HEARTBEAT (Phát hiện cùng trình duyệt) ────────

  // Check if another tab holds Web Lock or active localStorage heartbeat
  const checkBrowserConcurrency = useCallback(async () => {
    if (!isTargetValid) return false

    // 1. Try Web Locks API if supported (ONLY check if another tab holds it, not this tab)
    if (!isHoldingWebLockRef.current && typeof navigator !== 'undefined' && navigator.locks && navigator.locks.query) {
      try {
        const state = await navigator.locks.query()
        const held = state.held || []
        const isLockHeld = held.some((l) => l.name === `ai_gen_${lockKey}`)
        if (isLockHeld && !isGenerating && !isHoldingWebLockRef.current) {
          setIsBrowserRunning(true)
          return true
        }
      } catch (err) {
        console.warn('[WEB_LOCKS_QUERY_ERROR]', err)
      }
    }

    // 2. Fallback / supplementary check: localStorage heartbeat (with >= 15s TTL)
    try {
      const raw = localStorage.getItem(storageActiveKey)
      if (raw) {
        const active = JSON.parse(raw)
        const age = Date.now() - (active.lastHeartbeat || 0)
        // If active payload belongs to ANOTHER tab and is still fresh:
        if (active.isRunning && active.tabId && active.tabId !== tabIdRef.current && age < HEARTBEAT_EXPIRY_MS && !isGenerating) {
          setIsBrowserRunning(true)
          setBrowserProgress({ current: active.current || 0, total: active.total || 0 })
          return true
        }
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (!isGenerating && !isHoldingWebLockRef.current) {
      setIsBrowserRunning(false)
      setBrowserProgress(null)
    }
    return false
  }, [isTargetValid, lockKey, isGenerating, storageActiveKey])

  // BroadcastChannel setup for cross-tab realtime messaging
  useEffect(() => {
    if (!isTargetValid || typeof window === 'undefined') return

    let bc = null
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      broadcastChannelRef.current = bc

      bc.onmessage = (event) => {
        const msg = event?.data
        if (!msg || msg.targetKey !== lockKey) return

        if (msg.type === 'AI_GEN_STARTED' || msg.type === 'AI_GEN_CHUNK_START') {
          if (!isGenerating) {
            setIsBrowserRunning(true)
            if (msg.progress) setBrowserProgress(msg.progress)
          }
        } else if (msg.type === 'AI_GEN_PROGRESS' || msg.type === 'AI_GEN_CHUNK_END') {
          if (!isGenerating) {
            setIsBrowserRunning(true)
            if (msg.progress) setBrowserProgress(msg.progress)
          }
        } else if (msg.type === 'AI_GEN_STOPPED' || msg.type === 'AI_GEN_COMPLETED') {
          if (!isGenerating) {
            setIsBrowserRunning(false)
            setBrowserProgress(null)
            checkBrowserConcurrency()
          }
        }
      }
    } catch {
      // BroadcastChannel not supported in this environment
    }

    // Storage event listener as fallback
    const handleStorage = (e) => {
      if (e.key === storageActiveKey) {
        checkBrowserConcurrency()
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      if (bc) {
        try { bc.close() } catch {}
        broadcastChannelRef.current = null
      }
      window.removeEventListener('storage', handleStorage)
    }
  }, [isTargetValid, lockKey, isGenerating, checkBrowserConcurrency, storageActiveKey])

  // ── 2. SERVER STATUS CHECK & GRACE WINDOW ON MOUNT ─────────────────────────

  const fetchServerStatus = useCallback(async () => {
    if (!isTargetValid) return null
    try {
      const endpoint = type === 'exam'
        ? `/admin/exams/${numericId}/explanation-status`
        : `/practice/admin/${skill}/${numericId}/explanation-status`
      const res = await api.get(endpoint)
      return res.data
    } catch (err) {
      console.warn('[FETCH_EXPLANATION_STATUS_ERROR]', err?.response?.data || err.message)
      return null
    }
  }, [isTargetValid, type, numericId, skill])

  useEffect(() => {
    if (!isTargetValid) return
    const currentTarget = `${type}_${numericId}`
    if (inspectedTargetRef.current === currentTarget) return
    inspectedTargetRef.current = currentTarget

    let isMounted = true
    let graceTimer = null
    let pollTimer = null

    const runMountInspection = async () => {
      // Start grace window inspection
      setIsCheckingStatus(true)

      // Initial check browser concurrency
      await checkBrowserConcurrency()

      // Initial server query
      const status1 = await fetchServerStatus()
      if (!isMounted) return

      const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'

      if (status1) {
        setServerStatus(status1)
        setIsServerRunning(Boolean(status1.isLocked))
        if (status1.isLocked) {
          setIsCheckingStatus(false)
          return
        }
        if (isTestEnv) {
          setIsCheckingStatus(false)
          return
        }
      } else {
        setIsServerRunning(false)
        if (isTestEnv) {
          setIsCheckingStatus(false)
          return
        }
      }

      // If server is not locked, wait grace window (5s) to avoid race between chunks
      // Query again at halfway (2.5s)
      pollTimer = setTimeout(async () => {
        if (!isMounted) return
        const status2 = await fetchServerStatus()
        if (!isMounted) return
        if (status2) {
          setServerStatus(status2)
          setIsServerRunning(Boolean(status2.isLocked))
          if (status2.isLocked) {
            setIsCheckingStatus(false)
          }
        } else {
          setIsServerRunning(false)
        }
      }, Math.min(2500, Math.floor(GRACE_WINDOW_MS / 2)))

      // Conclude grace window after 5s
      graceTimer = setTimeout(() => {
        if (!isMounted) return
        setIsCheckingStatus(false)
        setIsServerRunning(false)
      }, GRACE_WINDOW_MS)
    }

    runMountInspection()

    return () => {
      isMounted = false
      if (pollTimer) clearTimeout(pollTimer)
      if (graceTimer) clearTimeout(graceTimer)
    }
  }, [isTargetValid, type, numericId, fetchServerStatus, checkBrowserConcurrency])

  // Khi server báo đang có tiến trình sinh AI (ví dụ vào lại trang sau khi rời
  // đi giữa chừng), tự động hỏi lại trạng thái định kỳ để:
  // - cập nhật số câu đã xong trên banner,
  // - tự mở khóa các nút ngay khi server hoàn tất / hết TTL khóa (180s),
  // thay vì bắt người dùng F5 mới thấy trạng thái mới.
  useEffect(() => {
    if (!isTargetValid || !isServerRunning) return

    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
    const intervalMs = isTestEnv ? 50 : 4000
    let cancelled = false

    const timer = setInterval(async () => {
      const status = await fetchServerStatus()
      if (cancelled || !status) return
      setServerStatus(status)
      setIsServerRunning(Boolean(status.isLocked))
    }, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isTargetValid, isServerRunning, fetchServerStatus])

  // ── 3. LOCAL GENERATION LIFECYCLE MANAGERS ─────────────────────────────────

  // Khi component bị unmount giữa lúc đang sinh (chuyển trang, back trình duyệt,
  // đóng tab SPA…), abort request để server dừng ghi dữ liệu và nhả khóa ngay,
  // đồng thời dọn heartbeat để tab khác không thấy "đang chạy" treo.
  const lockKeyRef = useRef(lockKey)
  const storageActiveKeyRef = useRef(storageActiveKey)
  lockKeyRef.current = lockKey
  storageActiveKeyRef.current = storageActiveKey

  useEffect(() => () => {
    const controller = abortControllerRef.current
    if (!controller) return
    abortControllerRef.current = null
    try { controller.abort() } catch {}
    try { localStorage.removeItem(storageActiveKeyRef.current) } catch {}
    try { webLockReleaseRef.current?.() } catch {}
    webLockReleaseRef.current = null
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'AI_GEN_STOPPED',
        targetKey: lockKeyRef.current,
      })
    } catch {}
  }, [])


  const broadcastMessage = useCallback((type, data = {}) => {
    try {
      broadcastChannelRef.current?.postMessage({
        type,
        targetKey: lockKey,
        ...data,
      })
    } catch {}
  }, [lockKey])

  const startLocalGeneration = useCallback(async ({ abortController, total = 0, current = 0 }) => {
    setIsGenerating(true)
    setIsCancelling(false)
    setIsBrowserRunning(false)
    setIsServerRunning(false)
    setIsCheckingStatus(false)
    isHoldingWebLockRef.current = true
    abortControllerRef.current = abortController
    setBannerDismissed(true)

    // 1. Acquire Web Lock
    if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
      navigator.locks.request(`ai_gen_${lockKey}`, () => {
        return new Promise((resolve) => {
          webLockReleaseRef.current = resolve
        })
      }).catch((e) => console.warn('[WEB_LOCK_ACQUIRE_ERROR]', e))
    }

    // 2. Set active state and evidence in localStorage
    const activePayload = {
      isRunning: true,
      tabId: tabIdRef.current,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      current,
      total,
    }
    try {
      localStorage.setItem(storageActiveKey, JSON.stringify(activePayload))
      localStorage.setItem(storageEvidenceKey, JSON.stringify({ startedAt: Date.now(), total }))
      setEvidenceVersion((v) => v + 1)
    } catch {}

    // 3. Notify other tabs
    broadcastMessage('AI_GEN_STARTED', { progress: { current, total } })
  }, [lockKey, storageActiveKey, storageEvidenceKey, broadcastMessage])

  const notifyChunkStart = useCallback(({ current, total }) => {
    try {
      const activePayload = {
        isRunning: true,
        tabId: tabIdRef.current,
        lastHeartbeat: Date.now(),
        lastChunkAt: Date.now(),
        current,
        total,
      }
      localStorage.setItem(storageActiveKey, JSON.stringify(activePayload))
    } catch {}
    broadcastMessage('AI_GEN_CHUNK_START', { progress: { current, total } })
  }, [storageActiveKey, broadcastMessage])

  const notifyChunkEnd = useCallback(({ current, total }) => {
    try {
      const activePayload = {
        isRunning: true,
        tabId: tabIdRef.current,
        lastHeartbeat: Date.now(),
        lastChunkAt: Date.now(),
        current,
        total,
      }
      localStorage.setItem(storageActiveKey, JSON.stringify(activePayload))
    } catch {}
    broadcastMessage('AI_GEN_CHUNK_END', { progress: { current, total } })
  }, [storageActiveKey, broadcastMessage])

  const updateLocalProgress = useCallback(({ current, total, label }) => {
    setLocalProgress({ current, total, label })
    try {
      const raw = localStorage.getItem(storageActiveKey)
      if (raw) {
        const obj = JSON.parse(raw)
        obj.current = current
        obj.total = total
        obj.tabId = tabIdRef.current
        obj.lastHeartbeat = Date.now()
        localStorage.setItem(storageActiveKey, JSON.stringify(obj))
      }
    } catch {}
    broadcastMessage('AI_GEN_PROGRESS', { progress: { current, total } })
  }, [storageActiveKey, broadcastMessage])

  const endLocalGeneration = useCallback(({ completed = true, cancelled = false } = {}) => {
    setIsGenerating(false)
    setIsCancelling(false)
    setIsBrowserRunning(false)
    setIsServerRunning(false)
    setIsCheckingStatus(false)
    setLocalProgress(null)
    abortControllerRef.current = null
    isHoldingWebLockRef.current = false

    // 1. Release Web Lock
    if (webLockReleaseRef.current) {
      try { webLockReleaseRef.current() } catch {}
      webLockReleaseRef.current = null
    }

    // 2. Remove active state from localStorage
    try {
      localStorage.removeItem(storageActiveKey)
      if (completed && !cancelled) {
        localStorage.removeItem(storageEvidenceKey)
        setEvidenceVersion((v) => v + 1)
      }
    } catch {}

    // 3. Notify other tabs
    broadcastMessage(cancelled ? 'AI_GEN_STOPPED' : 'AI_GEN_COMPLETED')

    // 4. Refresh server status and synchronize isServerRunning
    fetchServerStatus().then((s) => {
      if (s) {
        setServerStatus(s)
        setIsServerRunning(Boolean(s.isLocked))
      } else {
        setIsServerRunning(false)
      }
    })
  }, [storageActiveKey, storageEvidenceKey, broadcastMessage, fetchServerStatus])

  // Periodic heartbeat while generating in this tab
  useEffect(() => {
    if (!isGenerating) return

    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem(storageActiveKey)
        if (raw) {
          const obj = JSON.parse(raw)
          obj.lastHeartbeat = Date.now()
          localStorage.setItem(storageActiveKey, JSON.stringify(obj))
        }
      } catch {}
    }, 5000)

    return () => clearInterval(interval)
  }, [isGenerating, storageActiveKey])

  // ── 4. EXIT CONFIRMATION (CHẶN THOÁT KHI ĐANG SINH) ─────────────────────────

  // Prevent tab close / reload when generating
  useEffect(() => {
    if (!isGenerating) return

    const handleBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = 'Đang sinh giải thích AI. Rời đi lúc này sẽ dừng tiến trình.'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isGenerating])

  const openExitConfirm = useCallback((onConfirmExit) => {
    pendingExitActionRef.current = onConfirmExit
    setExitConfirmOpen(true)
  }, [])

  const closeExitConfirm = useCallback(() => {
    setExitConfirmOpen(false)
    pendingExitActionRef.current = null
  }, [])

  const confirmExit = useCallback(() => {
    // Abort active HTTP requests
    if (abortControllerRef.current) {
      try { abortControllerRef.current.abort() } catch {}
    }
    endLocalGeneration({ cancelled: true })
    setExitConfirmOpen(false)

    // Execute pending navigation if any
    if (typeof pendingExitActionRef.current === 'function') {
      const act = pendingExitActionRef.current
      pendingExitActionRef.current = null
      act()
    }
  }, [endLocalGeneration])

  // Safe navigation interceptor: if generating, open modal; otherwise execute immediately
  const handleSafeActionOrExit = useCallback((action) => {
    if (isGenerating) {
      openExitConfirm(action)
      return false
    }
    action?.()
    return true
  }, [isGenerating, openExitConfirm])

  // ── 5. CALCULATE OPERATION LOCK & TOOLTIPS ──────────────────────────────────

  const isLockedOperation = useMemo(() => {
    return isGenerating || isCancelling || isBrowserRunning || isServerRunning
  }, [isGenerating, isCancelling, isBrowserRunning, isServerRunning])

  const isLockedGenerate = useMemo(() => {
    return isLockedOperation || isCheckingStatus
  }, [isLockedOperation, isCheckingStatus])

  const lockTooltip = useMemo(() => {
    if (isCancelling) return 'Đang hủy tiến trình sinh AI, vui lòng chờ trong giây lát...'
    if (isGenerating) return 'Đang sinh giải thích AI, vui lòng chờ hoặc bấm Hủy'
    if (isCheckingStatus) return 'Đang kiểm tra trạng thái sinh AI...'
    if (isBrowserRunning) return 'Đang có tiến trình sinh AI đang chạy ở tab khác trong trình duyệt'
    if (isServerRunning) return 'Hệ thống đang tạo giải thích AI cho bài này ở phiên khác'
    return null
  }, [isCancelling, isGenerating, isCheckingStatus, isBrowserRunning, isServerRunning])

  // ── 6. RESUME BANNER STATE DETERMINATION (Sửa 2) ─────────────────────────────

  const hasLocalEvidence = useMemo(() => {
    try {
      const ev = localStorage.getItem(storageEvidenceKey)
      return Boolean(ev)
    } catch {
      return false
    }
  }, [storageEvidenceKey, evidenceVersion])

  const resumeBanner = useMemo(() => {
    if (bannerDismissed || isGenerating) return null

    // 1. Grace window checking state
    if (isCheckingStatus) {
      return {
        variant: 'checking',
        message: 'Đang kiểm tra trạng thái sinh AI...',
      }
    }

    // 2. Active running banner (either in browser or on server)
    if (isBrowserRunning || isServerRunning) {
      // Ưu tiên số liệu server khi server đang giữ khóa: số câu đã ghi vào DB là
      // chính xác nhất (heartbeat localStorage có thể còn sót từ tab vừa đóng).
      const p = (isServerRunning && serverStatus)
        ? { current: serverStatus.generatedCount, total: serverStatus.totalQuestions }
        : browserProgress
      const current = p?.current || 0
      const total = p?.total || 0
      return {
        variant: 'running',
        current,
        total,
        message: total > 0
          ? `Đang có tiến trình sinh AI cho bài này (${current}/${total} câu đã hoàn tất)...`
          : 'Đang có tiến trình sinh AI cho bài này...',
      }
    }

    // 3. Completed or no data: don't show unnecessary banners
    if (!serverStatus) return null
    if (serverStatus.unprocessedCount === 0) return null

    // 4. Interrupted banner (only when there is evidence of previous run)
    if (hasLocalEvidence && serverStatus.unprocessedCount > 0) {
      return {
        variant: 'interrupted',
        title: 'Lần sinh trước chưa hoàn tất',
        message: `Đã xong ${serverStatus.generatedCount}/${serverStatus.totalQuestions} câu, còn ${serverStatus.unprocessedCount} câu chưa có giải thích.`,
        actionLabel: 'Sinh tiếp các câu còn lại',
        onAction: () => onResumeGenerate?.(serverStatus.unprocessedQuestionNumbers),
        onDismiss: () => setBannerDismissed(true),
      }
    }

    // 5. Neutral pending banner (when some questions have explanations, but no local evidence)
    if (serverStatus.generatedCount > 0 && serverStatus.unprocessedCount > 0) {
      return {
        variant: 'unprocessed',
        title: 'Tiến độ lời giải',
        message: `Còn ${serverStatus.unprocessedCount} câu chưa có giải thích.`,
        actionLabel: 'Sinh các câu còn lại',
        onAction: () => onResumeGenerate?.(serverStatus.unprocessedQuestionNumbers),
        onDismiss: () => setBannerDismissed(true),
      }
    }

    // 6. Untouched exam (0 explanations generated): DO NOT show interrupted banner
    return null
  }, [
    bannerDismissed,
    isGenerating,
    isCheckingStatus,
    isBrowserRunning,
    isServerRunning,
    browserProgress,
    serverStatus,
    hasLocalEvidence,
    onResumeGenerate,
  ])

  return {
    isGenerating,
    setIsGenerating,
    isCancelling,
    setIsCancelling,
    localProgress,
    isBrowserRunning,
    browserProgress,
    isServerRunning,
    isCheckingStatus,
    isLockedOperation,
    isLockedGenerate,
    lockTooltip,
    serverStatus,
    resumeBanner,
    exitConfirmOpen,
    openExitConfirm,
    closeExitConfirm,
    confirmExit,
    handleSafeActionOrExit,
    startLocalGeneration,
    notifyChunkStart,
    notifyChunkEnd,
    updateLocalProgress,
    endLocalGeneration,
    fetchServerStatus,
  }
}
