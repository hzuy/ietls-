import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addRunOutcome, clearRunReport, createBlockedReport, createRunReport,
  finishRunReport, loadRunReport, makeRunReportKey, saveRunReport,
} from '../utils/explanationRunReport'

// Practice IDs and exam IDs may overlap: keep their session reports separate.
export function usePracticeExplanationReport({ skill, practiceId, enabled }) {
  const key = enabled && practiceId ? makeRunReportKey(`practice_${skill}`, practiceId) : null
  const [report, setReport] = useState(null)
  const [statuses, setStatuses] = useState({})
  const initialRef = useRef(null)
  const latestRef = useRef(null)
  const scopeRef = useRef([])

  useEffect(() => {
    const saved = loadRunReport(key)
    latestRef.current = saved
    setReport(saved)
    const next = {}
    for (const row of saved?.rows || []) if (row.number) next[row.number] = 'error'
    for (const row of saved?.needsRetry || []) if (row.number) next[row.number] = 'retry'
    setStatuses(next)
  }, [key])

  const persist = useCallback(next => {
    latestRef.current = next
    setReport(next)
    saveRunReport(key, next)
  }, [key])

  const start = useCallback((numbers, { scope = 'all' } = {}) => {
    scopeRef.current = numbers
    const initial = createRunReport({ examId: practiceId, skill, scope, totalGroups: 1, totalQuestions: numbers.length })
    initialRef.current = initial
    persist(initial)
    setStatuses(Object.fromEntries(numbers.map(number => [number, 'generating'])))
  }, [practiceId, skill, persist])

  const progress = useCallback(data => {
    if (!data || !initialRef.current) return
    const numbers = scopeRef.current
    setStatuses(prev => {
      const next = { ...prev }
      const remaining = new Set((data.remainingQuestionNumbers || []).map(Number))
      for (const number of numbers) {
        if (next[number] === 'error' || next[number] === 'retry') continue
        next[number] = remaining.has(number) ? 'generating' : 'done'
      }
      for (const error of data.errors || []) if (error.number) next[error.number] = 'error'
      for (const item of data.needsRetryQuestions || []) next[typeof item === 'object' ? item.number : item] = 'retry'
      return next
    })
    // Keep a partial report on refresh, without counting each chunk as a group.
    const next = { ...addRunOutcome(latestRef.current || initialRef.current, {
      group: null, sentNumbers: numbers,
      loopResult: { ...data, totalGenerated: data.generatedCount || 0 },
    }), finishedGroups: 0 }
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
          if (states[number] === 'generating') delete states[number]
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
    setReport(null)
    setStatuses({})
  }, [key])

  const generatingNumbers = useMemo(() => new Set(Object.keys(statuses)
    .filter(number => statuses[number] === 'generating').map(Number)), [statuses])
  const errorMessages = useMemo(() => Object.fromEntries((report?.rows || [])
    .filter(row => row.number).map(row => [row.number, row.message])), [report])
  const visibleReport = report?.status === 'done' && !report?.needsRetry?.length ? null : report

  return { report: visibleReport, statuses, generatingNumbers, errorMessages, start, progress, finish, block, dismiss }
}
