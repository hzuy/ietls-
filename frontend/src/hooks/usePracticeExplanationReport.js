import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addRunOutcome, clearRunReport, createBlockedReport, createRunReport,
  finishRunReport, makeRunReportKey, updateRunProgress, reconcileRunReport,
} from '../utils/explanationRunReport'

// Keep legacy report cleanup scoped to this practice, separate from Test IDs.
export function usePracticeExplanationReport({ skill, practiceId, enabled, groups }) {
  const key = enabled && practiceId ? makeRunReportKey(`practice_${skill}`, practiceId) : null
  const [report, setReport] = useState(null)
  const [statuses, setStatuses] = useState({})
  const initialRef = useRef(null)
  const latestRef = useRef(null)
  const scopeRef = useRef([])

  useEffect(() => {
    clearRunReport(key)
    latestRef.current = null
    initialRef.current = null
    scopeRef.current = []
    setReport(null)
    setStatuses({})
  }, [key])

  const persist = useCallback(next => {
    latestRef.current = next
    setReport(next)
  }, [])

  const start = useCallback((numbers, { scope = 'all' } = {}) => {
    scopeRef.current = numbers
    const initial = createRunReport({ examId: practiceId, skill, scope, totalGroups: 1, totalQuestions: numbers.length,
      questionNumbers: numbers, previousReport: latestRef.current })
    initialRef.current = initial
    persist(initial)
    setStatuses({ ...Object.fromEntries(initial.rows.filter(row => row.number).map(row => [row.number, 'error'])),
      ...Object.fromEntries(initial.needsRetry.map(row => [row.number, 'retry'])),
      ...Object.fromEntries(numbers.map(number => [number, 'queued'])) })
  }, [practiceId, skill, persist])

  const progress = useCallback(data => {
    if (!data || !initialRef.current) return
    const numbers = scopeRef.current
    setStatuses(prev => {
      const next = { ...prev }
      const remaining = new Set((data.remainingQuestionNumbers || []).map(Number))
      for (const number of numbers) {
        if (next[number] === 'error' || next[number] === 'retry') continue
        next[number] = remaining.has(number) ? 'queued' : 'done'
      }
      for (const error of data.errors || []) if (error.number) next[error.number] = 'error'
      for (const item of data.needsRetryQuestions || []) next[typeof item === 'object' ? item.number : item] = 'retry'
      return next
    })
    // Update the current visit's report without counting each chunk as a group.
    const next = updateRunProgress(latestRef.current || initialRef.current, { data, sentNumbers: numbers })
    persist(next)
  }, [persist])

  const finish = useCallback(result => {
    const numbers = scopeRef.current
    const next = finishRunReport(addRunOutcome(initialRef.current, {
      group: null, sentNumbers: numbers, loopResult: result,
    }), { cancelled: Boolean(result?.cancelled) })
    persist(next)
    setStatuses(prev => {
      const states = { ...prev }
      for (const number of numbers) {
        if (result?.cancelled) {
          if (states[number] === 'generating' || states[number] === 'queued') delete states[number]
        } else states[number] = 'done'
      }
      for (const row of next?.rows || []) if (row.number) states[row.number] = 'error'
      for (const row of next?.needsRetry || []) if (row.number) states[row.number] = 'retry'
      return states
    })
  }, [persist])

  const block = useCallback(errors => {
    setStatuses({})
    persist(createBlockedReport({ examId: practiceId, skill,
      message: `Có ${errors.length} lỗi cần sửa trước khi sinh giải thích.`, details: errors }))
  }, [practiceId, skill, persist])

  const dismiss = useCallback(() => {
    clearRunReport(key)
    latestRef.current = null
    setReport(null)
    setStatuses({})
  }, [key])

  const generatingNumbers = useMemo(() => new Set(Object.keys(statuses)
    .filter(number => statuses[number] === 'generating').map(Number)), [statuses])
  const errorMessages = useMemo(() => Object.fromEntries((report?.rows || [])
    .filter(row => row.number).map(row => [row.number, { ...row, failedAt: row.failedAt || report.finishedAt }])), [report])
  const visibleReport = useMemo(() => reconcileRunReport(report, groups), [report, groups])
  return { report: visibleReport, statuses, generatingNumbers, errorMessages, start, progress, finish, block, dismiss }
}
