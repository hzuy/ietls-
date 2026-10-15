import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Breadcrumb from '../components/common/Breadcrumb'

import { useAuth } from '../context/AuthContext'
import { checkDraft, clearDraft } from '../services/draftService'
import { getMyHistory } from '../services/historyService'
import { Headphones, BookOpen, PenTool, Mic, AlertCircle, RefreshCw, FolderArchive, PlayCircle, ChevronDown, History, PauseCircle, RotateCcw, Lightbulb, FileText } from 'lucide-react'
import { BACKEND_URL, resolveImg, handleImgError } from '../utils/media'
import AcademicCover from '../components/common/AcademicCover'
import Card from '../components/common/Card'
import PillButton from '../components/common/PillButton'
import { UserExamListSkeleton } from '../components/skeletons'
import ExamAttemptListModal from '../components/exam/ExamAttemptListModal'
import ExamActionDialog from '../components/common/ExamActionDialog'
import { queryClient } from '../lib/queryClient'
import { fullTestsQueryOptions } from '../hooks/useCatalog'

const SKILL_META = {
  listening: { label: 'Listening', Icon: Headphones, colorVar: '--skill-l-color', bgVar: '--skill-l-bg', borderVar: '--skill-l-border', path: '/listening', desc: '4 sections · 40 câu · 40 phút' },
  reading:   { label: 'Reading',   Icon: BookOpen,   colorVar: '--skill-r-color', bgVar: '--skill-r-bg', borderVar: '--skill-r-border', path: '/reading',   desc: '3 passages · 40 câu · 60 phút' },
  writing:   { label: 'Writing',   Icon: PenTool,    colorVar: '--skill-w-color', bgVar: '--skill-w-bg', borderVar: '--skill-w-border', path: '/writing',   desc: 'Task 1 + Task 2 · AI chấm điểm' },
  speaking:  { label: 'Speaking',  Icon: Mic,        colorVar: '--skill-s-color', bgVar: '--skill-s-bg', borderVar: '--skill-s-border', path: '/speaking',  desc: 'Part 1+2+3 · AI nhận xét' },
}
const SKILL_ORDER = ['listening', 'reading', 'writing', 'speaking']

const menuItemCls = 'w-full h-8 flex items-center gap-2 px-2.5 text-[13px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer'

function ActionDropdown({ exam, skill, testNumber, m, hasDraft, historyInfo = {}, setHistoryModal, navigate, user, openAuthModal, location, isLastRow, onViewResult, onClearDraft }) {
  const [open, setOpen] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const dropdownRef = useRef(null)

  const examId = exam?.id
  const historyList = (examId && historyInfo?.[examId]) || []
  const hasHistory = (historyList.length > 0) ||
                     (skill === 'writing' && historyInfo?.writingHistory?.includes(examId)) ||
                     (skill === 'speaking' && historyInfo?.speakingHistory?.includes(examId))

  const isContinue = hasDraft
  const isRetake = !hasDraft && hasHistory

  let btnText = 'Làm bài'
  let Icon = PlayCircle
  if (isContinue) {
    btnText = 'Làm tiếp'
    Icon = PauseCircle
  } else if (isRetake) {
    btnText = 'Làm lại'
    Icon = RotateCcw
  }

  const requireUser = () => {
    if (user) return true
    openAuthModal('login', (location?.pathname || '') + (location?.search || ''))
    return false
  }

  const handleClickMain = () => {
    if (!requireUser()) return
    if (hasDraft) navigate(`${m.path}/${exam?.id}?resume=true`)
    else navigate(`${m.path}/${exam?.id}`)
  }

  const handleOpenHistory = () => {
    setOpen(false)
    if (!requireUser()) return
    setHistoryModal({ skill, skillLabel: m.label, attempts: historyInfo?.[exam?.id] || [] })
  }

  const handleViewResult = () => {
    setOpen(false)
    if (!requireUser()) return
    onViewResult()
  }

  const handleAskRestart = () => {
    setOpen(false)
    if (!requireUser()) return
    setConfirmRestart(true)
  }

  const handleRestart = () => {
    clearDraft(user.id || user._id, exam?.id, skill)
    onClearDraft?.(testNumber, skill)
    setConfirmRestart(false)
    navigate(`${m.path}/${exam?.id}`)
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const pillBase = 'h-8 inline-flex items-center justify-center gap-1.5 text-[13px] font-medium leading-none transition-colors cursor-pointer select-none'

  if (!hasHistory && !hasDraft) {
    return (
      <button
        type="button"
        onClick={handleClickMain}
        className={`${pillBase} w-[116px] rounded-full ${isContinue
          ? 'border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          : 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white'}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">{btnText}</span>
      </button>
    )
  }

  return (
    <div ref={dropdownRef} className="relative inline-flex" onClick={e => e.stopPropagation()}>
      <div className="w-[116px] h-8 inline-flex items-stretch rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
        <button
          type="button"
          onClick={handleClickMain}
          className={`${pillBase} flex-1 pl-3 pr-1.5 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
          <span className="whitespace-nowrap">{btnText}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Tùy chọn khác"
          aria-haspopup="menu"
          aria-expanded={open}
          className="w-7 flex items-center justify-center border-l border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-800 transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute ${isLastRow ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'} left-1/2 -translate-x-1/2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-1 z-50 text-left`}
        >
          {hasDraft && (
            <button type="button" role="menuitem" onClick={handleAskRestart} className={menuItemCls}>
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="whitespace-nowrap">Làm lại từ đầu</span>
            </button>
          )}
          {hasHistory && (
            <>
              <button type="button" role="menuitem" onClick={handleViewResult} className={menuItemCls}>
                <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="whitespace-nowrap">Xem kết quả gần nhất</span>
              </button>
              <button type="button" role="menuitem" onClick={handleOpenHistory} className={menuItemCls}>
                <History className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="whitespace-nowrap">Lịch sử các lần làm</span>
              </button>
            </>
          )}
        </div>
      )}

      <ExamActionDialog
        open={confirmRestart}
        title="Làm lại từ đầu?"
        description={`Bài ${m.label} đang làm dở sẽ bị xóa và bạn bắt đầu một lượt mới.`}
        cancelLabel="Hủy"
        confirmLabel="Làm lại"
        onCancel={() => setConfirmRestart(false)}
        onConfirm={handleRestart}
      />
    </div>
  )
}

function SkillCell({ exam, skill, testNumber, draftInfo = {}, historyInfo = {}, setHistoryModal, navigate, user, openAuthModal, location, isLastRow, onClearDraft }) {
  const m = SKILL_META[skill]
  const hasDraft = draftInfo?.[`${testNumber}-${skill}`]?.hasDraft
  const examId = exam?.id
  const historyList = (examId && historyInfo?.[examId]) || []
  const hasHistory = (historyList.length > 0) ||
                     (skill === 'writing' && historyInfo?.writingHistory?.includes(examId)) ||
                     (skill === 'speaking' && historyInfo?.speakingHistory?.includes(examId))

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-1 opacity-50">
        <div className="w-12 h-12 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400">
          <m.Icon className="w-5 h-5 stroke-[1.5]" />
        </div>
        <span className="h-8 inline-flex items-center text-[12px] text-zinc-400 font-medium">Chưa có đề</span>
      </div>
    )
  }

  const latestAttempt = historyList[0]
  const band = latestAttempt?.bandScore != null
    ? (typeof latestAttempt.bandScore === 'number' ? latestAttempt.bandScore.toFixed(1) : String(latestAttempt.bandScore))
    : (hasHistory ? '0.0' : null)

  const viewResult = () => {
    if (skill === 'reading') navigate(`/reading/${exam.id}/explanation`)
    else if (skill === 'listening') navigate(`/listening/${exam.id}/explanation`)
    else navigate(`${m.path}/${exam.id}?viewResult=true`)
  }

  const handleCircleClick = () => {
    if (!user) {
      openAuthModal('login', (location?.pathname || '') + (location?.search || ''))
      return
    }
    if (hasDraft) navigate(`${m.path}/${exam.id}?resume=true`)
    else if (hasHistory) viewResult()
    else navigate(`${m.path}/${exam.id}`)
  }

  const skillColor = `var(${m.colorVar})`

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      {hasHistory && !hasDraft ? (
        <button
          type="button"
          onClick={handleCircleClick}
          title={`Điểm gần nhất: ${band ?? '0.0'} — Bấm để xem kết quả`}
          className="w-12 h-12 rounded-full border-2 bg-white dark:bg-zinc-800 flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer hover:scale-105 transition-transform"
          style={{ borderColor: skillColor, color: skillColor }}
        >
          <m.Icon className="w-3.5 h-3.5" />
          <span className="text-[12px] font-bold font-mono tabular-nums leading-none">{band ?? '0.0'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCircleClick}
          title={hasDraft ? 'Đang làm dở — Bấm để làm tiếp' : `Làm bài ${m.label}`}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-transform ${hasDraft ? 'border-2 border-dashed' : 'border'}`}
          style={{ borderColor: hasDraft ? skillColor : `var(${m.borderVar})`, background: `var(${m.bgVar})`, color: skillColor }}
        >
          <m.Icon className="w-5 h-5 stroke-[1.75]" />
          {hasDraft && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white dark:border-zinc-900" />}
        </button>
      )}

      <ActionDropdown
        exam={exam}
        skill={skill}
        testNumber={testNumber}
        m={m}
        hasDraft={hasDraft}
        historyInfo={historyInfo}
        setHistoryModal={setHistoryModal}
        navigate={navigate}
        user={user}
        openAuthModal={openAuthModal}
        location={location}
        isLastRow={isLastRow}
        onClearDraft={onClearDraft}
        onViewResult={viewResult}
      />
    </div>
  )
}

export default function FullTestDetail() {
  const { id: seriesId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, openAuthModal } = useAuth()

  const bookNumber = new URLSearchParams(location.search).get("book")

  const [allBooks, setAllBooks] = useState([])
  const [bookData, setBookData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [draftInfo, setDraftInfo] = useState({}) // { [testNumber-skill]: checkDraft result }
  const [historyModal, setHistoryModal] = useState(null) // { skill, skillLabel, attempts }

  const handleClearDraft = useCallback((testNumber, skill) => {
    setDraftInfo(prev => ({
      ...prev,
      [`${testNumber}-${skill}`]: { hasDraft: false }
    }))
  }, [])

  const fetchBookData = useCallback(() => {
    if (!bookNumber) return

    setLoading(true)
    setFetchError(false)

    queryClient.fetchQuery(fullTestsQueryOptions)
      .then(data => {
        const booksMap = data.reduce((acc, item) => {
          const key = `${item.seriesId}-${item.bookNumber}`
          if (!acc[key]) {
            acc[key] = {
              seriesId: item.seriesId,
              seriesName: item.seriesName,
              bookNumber: item.bookNumber,
              coverImageUrl: item.coverImageUrl
            }
          }
          return acc
        }, {})
        const uniqueBooks = Object.values(booksMap)
        setAllBooks(uniqueBooks)

        const filtered = data.filter(item =>
          String(item.seriesId) === String(seriesId) &&
          String(item.bookNumber) === String(bookNumber)
        )

        if (filtered.length === 0) {
          setBookData({ empty: true })
          setLoading(false)
          return
        }

        const testMap = filtered.reduce((acc, item) => {
          const tn = item.testNumber
          if (!acc[tn]) acc[tn] = { testNumber: tn, exams: {} }
          Object.assign(acc[tn].exams, item.exams)
          return acc
        }, {})

        const sortedTests = Object.values(testMap).sort((a, b) => a.testNumber - b.testNumber)
        const first = filtered[0]

        setBookData({
          seriesId: first.seriesId,
          seriesName: first.seriesName,
          bookNumber: first.bookNumber,
          coverImageUrl: first.coverImageUrl,
          tests: sortedTests
        })
        setLoading(false)
      })
      .catch(() => {
        setFetchError(true)
        setLoading(false)
      })
  }, [seriesId, bookNumber])

  useEffect(() => {
    fetchBookData()
  }, [fetchBookData])

  const suggestions = useMemo(() => {
    if (!allBooks.length || !bookData) return []
    const filtered = allBooks.filter(b =>
      !(String(b.seriesId) === String(seriesId) && String(b.bookNumber) === String(bookNumber))
    )
    // Có chủ đích, ổn định giữa các lần tải (trước đây random mỗi lần tải — kiểu UX
    // trang bán hàng, không phù hợp học tập): ưu tiên cùng bộ sách với cuốn đang xem,
    // rồi trong mỗi nhóm sắp theo số thứ tự cuốn gần nhất (cuốn liền kề trước).
    // API danh sách full-test chỉ trả seriesId/seriesName/bookNumber/coverImageUrl,
    // không có trạng thái "đã làm/chưa làm" nên không dùng được tiêu chí đó ở đây.
    const currentBookNumber = Number(bookNumber)
    return [...filtered]
      .sort((a, b) => {
        const aSameSeries = String(a.seriesId) === String(seriesId) ? 0 : 1
        const bSameSeries = String(b.seriesId) === String(seriesId) ? 0 : 1
        if (aSameSeries !== bSameSeries) return aSameSeries - bSameSeries

        const aDist = Math.abs(Number(a.bookNumber) - currentBookNumber)
        const bDist = Math.abs(Number(b.bookNumber) - currentBookNumber)
        if (aDist !== bDist) return aDist - bDist

        if (a.seriesName !== b.seriesName) return a.seriesName.localeCompare(b.seriesName)
        return Number(a.bookNumber) - Number(b.bookNumber)
      })
      .slice(0, 4)
  }, [allBooks, seriesId, bookNumber, bookData])

  const userId = user?.id || user?._id
  const historyQuery = useQuery({
    queryKey: ['myHistory', userId, { limit: 100 }],
    queryFn: () => getMyHistory({ limit: 100 }),
    enabled: !!userId,
    staleTime: 1000 * 30,
  })

  const historyInfo = useMemo(() => {
    const data = historyQuery.data
    if (!data) return {}
    const historyMap = {}
    ;(data.history || []).forEach(h => {
      if (!historyMap[h.examId]) historyMap[h.examId] = []
      historyMap[h.examId].push(h)
    })
    for (const byExam of [data.writingAttemptsByExam, data.speakingAttemptsByExam]) {
      for (const [eId, attempts] of Object.entries(byExam || {})) {
        historyMap[eId] = [...(historyMap[eId] || []), ...attempts]
      }
    }
    return {
      ...historyMap,
      writingHistory: data.writingHistoryExamIds || [],
      speakingHistory: data.speakingHistoryExamIds || [],
    }
  }, [historyQuery.data])

  useEffect(() => {
    if (!userId || !bookData?.tests) return
    const info = {}
    for (const test of bookData.tests) {
      for (const skill of SKILL_ORDER) {
        const examId = test.exams[skill]?.id
        if (!examId) continue
        info[`${test.testNumber}-${skill}`] = checkDraft(userId, examId, skill)
      }
    }
    setDraftInfo(info)
  }, [userId, bookData])

  const historyLoading = !!userId && historyQuery.isPending

  if (!bookNumber) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16 text-center" style={{ color: 'var(--muted)' }}>Vui lòng chọn một cuốn sách cụ thể.</div>
    </div>
  )

  if (loading || historyLoading) return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="app-container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
          <div>
            {/* Hero sách */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs mb-5 flex gap-5 items-start">
              <div className="w-[80px] h-[110px] rounded-xl bg-zinc-200/80 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-48 bg-zinc-200/90 rounded-md animate-pulse" />
                <div className="h-4 w-72 bg-zinc-100 rounded-md animate-pulse" />
                <div className="flex gap-4 pt-2">
                  <div className="h-8 w-16 bg-zinc-100 rounded-lg animate-pulse" />
                  <div className="h-8 w-16 bg-zinc-100 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>

            <div className="h-6 w-32 bg-zinc-200/90 rounded-md animate-pulse mb-3.5" />
            <UserExamListSkeleton count={4} />
          </div>

          {/* Sidebar sách liên quan */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs space-y-4">
            <div className="h-4 w-32 bg-zinc-200/90 rounded-md animate-pulse" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-12 rounded-lg bg-zinc-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3.5 w-24 bg-zinc-200/80 rounded-md animate-pulse" />
                    <div className="h-3 w-16 bg-zinc-100 rounded-md animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (fetchError) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-zinc-400 mb-3 stroke-[1.75]" />
        <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16 }}>Không thể tải dữ liệu</p>
        <p className="mb-5" style={{ color: 'var(--muted)', fontSize: 14 }}>Vui lòng kiểm tra kết nối và thử lại.</p>
        <PillButton onClick={fetchBookData}>
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </PillButton>
      </Card>
    </div>
  )

  if (!bookData || bookData.empty) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card variant="flat" className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <FolderArchive className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
        <h3 className="font-bold text-zinc-900 text-base">Chưa có bài test nào</h3>
        <p className="text-zinc-500 text-sm mt-1">Cuốn sách này hiện chưa có bài test nào được thêm vào</p>
      </Card>
    </div>
  )

  const title = `${bookData.seriesName} ${bookData.bookNumber}`

  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-zinc-950 flex flex-col">
      <div className="app-container pt-4 pb-0">
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Phòng thi chuẩn hóa', to: '/full-test' },
            { label: title }
          ]}
        />
      </div>

      <div className="app-container py-6 flex-1">

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
          <div>
            {/* Hero */}
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', padding: 24, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 80, height: 110, borderRadius: '0.75rem', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, var(--ink), var(--ink-soft))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {resolveImg(bookData.coverImageUrl)
                    ? <img src={resolveImg(bookData.coverImageUrl)} alt={title} loading="lazy" decoding="async" onError={handleImgError} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <AcademicCover title={title} compact={true} />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-1.5">{title}</h1>
                  <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.6 }}>Luyện tập trọn bộ 4 kỹ năng trong cuốn sách {title}.</p>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{bookData.tests.length}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Bài test</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>4</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Kỹ năng</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Test list - Table layout matching DOL */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chọn bài test</h2>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px] table-fixed">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
                      <th scope="col" className="py-4 pl-6 pr-4 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider w-[130px]">
                        BÀI TEST
                      </th>
                      {SKILL_ORDER.map(skill => (
                        <th key={skill} scope="col" className="py-4 px-3 text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(${SKILL_META[skill].colorVar})` }} />
                            {SKILL_META[skill].label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {bookData.tests.map((test, idx) => {
                      const isLastRow = idx === bookData.tests.length - 1

                      return (
                        <tr key={test.testNumber} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-5 pl-6 pr-4 align-middle">
                            <div className="font-semibold text-[15px] text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                              Test {test.testNumber}
                            </div>
                          </td>
                          {SKILL_ORDER.map(skill => (
                            <td key={skill} className="py-5 px-2 text-center align-middle">
                              <SkillCell
                                exam={test.exams?.[skill]}
                                skill={skill}
                                testNumber={test.testNumber}
                                draftInfo={draftInfo}
                                historyInfo={historyInfo}
                                setHistoryModal={setHistoryModal}
                                navigate={navigate}
                                user={user}
                                openAuthModal={openAuthModal}
                                location={location}
                                isLastRow={isLastRow}
                                onClearDraft={handleClearDraft}
                              />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Suggestions */}
            <div style={{ background: 'var(--surface)', borderRadius: '1rem', border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Đề thi liên quan</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map(book => (
                  <div
                    key={`${book.seriesId}-${book.bookNumber}`}
                    onClick={() => navigate(`/full-test/${book.seriesId}?book=${book.bookNumber}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ width: 36, height: 48, borderRadius: '0.75rem', background: 'var(--surface-raised)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {book.coverImageUrl ? (
                        <img src={resolveImg(book.coverImageUrl)} alt="" loading="lazy" decoding="async" onError={handleImgError} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <AcademicCover title={`${book.seriesName} ${book.bookNumber}`} compact={true} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.seriesName} {book.bookNumber}
                      </p>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: 0 }}>Chi tiết bộ đề</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Modal History */}
      <ExamAttemptListModal
        open={!!historyModal}
        onClose={() => setHistoryModal(null)}
        skill={historyModal?.skill}
        skillLabel={historyModal?.skillLabel}
        attempts={historyModal?.attempts}
      />
    </div>
  )
}
