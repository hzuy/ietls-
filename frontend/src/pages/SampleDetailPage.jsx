import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, RefreshCw, FileQuestion, Sparkles, LoaderCircle } from 'lucide-react'

import Card from '../components/common/Card'
import PillButton from '../components/common/PillButton'
import { SkeletonText } from '../components/skeletons'
import SampleHeader from '../components/SampleHeader'
import { getSample } from '../services/sampleService'
import { sanitizeRichText } from '../utils/sanitizeHtml'
import { getSpeakingSampleAnswer } from '../services/examService'
import { useAuth } from '../context/AuthContext'

const TASK_LABELS = { task1: 'Task 1', task2: 'Task 2', task3: 'Task 3' }

export default function SampleDetailPage({ skill }) {
  const { id } = useParams()
  const [sample, setSample] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [answers, setAnswers] = useState({})
  const [answerLoading, setAnswerLoading] = useState({})
  const [answerErrors, setAnswerErrors] = useState({})
  const { user, openAuthModal } = useAuth()

  const fetchSample = useCallback(() => {
    setLoading(true)
    setError(false)
    getSample(skill, id)
      .then(data => setSample(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, skill])

  useEffect(() => {
    fetchSample()
  }, [fetchSample])

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Nút quay lại */}
        <Card className="p-8 md:p-12">
          <div style={{ maxWidth: '900px', margin: '0 auto' }} className="space-y-6">
            {/* Header bài mẫu: Tag pill, Title, Meta */}
            <div className="space-y-3 pb-6 border-b border-zinc-100">
              <div className="h-5 w-20 bg-zinc-200/80 rounded-full animate-pulse" />
              <div className="h-7 w-4/5 bg-zinc-200/90 rounded-md animate-pulse" />
              <div className="flex items-center gap-3 pt-1">
                <div className="h-4 w-28 bg-zinc-100 rounded-full animate-pulse" />
                <div className="h-4 w-20 bg-zinc-100 rounded-full animate-pulse" />
              </div>
            </div>

            {/* Nội dung đề bài & bài mẫu */}
            <SkeletonText lines={10} />
          </div>
        </Card>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 text-zinc-400 mb-3 stroke-[1.75]" />
        <p style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 16 }}>Không thể tải bài mẫu</p>
        <p className="mb-5" style={{ color: 'var(--muted)', fontSize: 14 }}>Vui lòng kiểm tra kết nối và thử lại.</p>
        <PillButton onClick={fetchSample}>
          <RefreshCw className="w-4 h-4" />
          Thử lại
        </PillButton>
      </Card>
    </div>
  )

  if (!sample) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Card variant="flat" className="max-w-md mx-auto mt-16 text-center py-12 px-6 flex flex-col items-center">
        <FileQuestion className="w-12 h-12 text-zinc-300 stroke-[1.5] mb-4" />
        <h3 className="font-bold text-zinc-900 text-base">Không tìm thấy bài mẫu</h3>
        <p className="text-zinc-500 text-sm mt-1">Bài mẫu này có thể đã bị gỡ hoặc không còn tồn tại</p>
      </Card>
    </div>
  )

  const taskLabel = TASK_LABELS[sample.level] || null
  const handleGetAnswer = async (question, partNumber) => {
    if (!user) {
      openAuthModal('login')
      return
    }
    setAnswerLoading(current => ({ ...current, [question.id]: true }))
    setAnswerErrors(current => ({ ...current, [question.id]: '' }))
    try {
      const result = await getSpeakingSampleAnswer({ questionText: question.questionText, partNumber })
      setAnswers(current => ({ ...current, [question.id]: result }))
    } catch {
      setAnswerErrors(current => ({ ...current, [question.id]: 'Chưa tạo được gợi ý. Vui lòng thử lại.' }))
    } finally {
      setAnswerLoading(current => ({ ...current, [question.id]: false }))
    }
  }
  // Tags đã bỏ khỏi luồng soạn Writing/Speaking Sample → không hiển thị nữa.
  // Dữ liệu tags cũ vẫn còn trong DB, chỉ không render.

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        <Card className="p-5 md:p-10">

          <div style={{ maxWidth: '900px', margin: '0 auto' }}>

            {/* Standardized Header */}
            <SampleHeader
              type={skill}
              taskLabel={taskLabel}
              title={sample.title}
              examType={sample.examType}
            />

            {/* Divider */}
            <div style={{ borderTop: '2px solid var(--border-soft)', marginBottom: 32 }} />

            {/* Content */}
            {sample.content && (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(sample.content) }}
                style={{ fontSize: 17, lineHeight: 1.8, color: 'var(--text)' }}
              />
            )}
            {skill === 'speaking' && sample.parts?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {sample.parts.map(part => (
                  <section key={part.id} aria-labelledby={`speaking-part-${part.id}`} className="rounded-2xl border border-zinc-200 bg-white p-5 md:p-6">
                    <div className="mb-5 border-b border-zinc-100 pb-4">
                      <span className="mb-2 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">Part {part.partNumber}</span>
                      <h2 id={`speaking-part-${part.id}`} className="m-0 text-lg font-bold text-zinc-900">{part.title || `Speaking Part ${part.partNumber}`}</h2>
                      {part.description && <p className="mb-0 mt-2 text-sm leading-6 text-zinc-600">{part.description}</p>}
                    </div>
                    {part.questions?.length > 0 && (
                      <ol className="m-0 flex list-none flex-col gap-4 p-0">
                        {part.questions.map((q, index) => (
                          <li key={q.id} className="rounded-xl bg-zinc-50 p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-zinc-500 ring-1 ring-zinc-200">{index + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="mb-3 mt-0 text-[15px] font-semibold leading-6 text-zinc-800">{q.questionText}</p>
                                {answers[q.id] ? (
                                  <div className="space-y-3 border-t border-zinc-200 pt-3">
                                    <div>
                                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-violet-700">Gợi ý trả lời Band 7.5–8.0</p>
                                      <p className="m-0 whitespace-pre-line text-sm leading-6 text-zinc-700">{answers[q.id].sampleAnswer}</p>
                                    </div>
                                    {answers[q.id].keyVocabulary?.length > 0 && (
                                      <div>
                                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Từ vựng hữu ích</p>
                                        <div className="flex flex-wrap gap-2">
                                          {answers[q.id].keyVocabulary.map((item, vocabIndex) => (
                                            <span key={`${item.phrase || item.word || item}-${vocabIndex}`} title={item.meaning || item.definition || ''} className="rounded-full border border-violet-100 bg-white px-2.5 py-1 text-xs text-violet-800">{item.phrase || item.word || item}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <button type="button" onClick={() => handleGetAnswer(q, part.partNumber)} disabled={!!answerLoading[q.id]} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60">
                                      {answerLoading[q.id] ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                      {answerLoading[q.id] ? 'Đang tạo gợi ý…' : 'Xem gợi ý trả lời & từ vựng'}
                                    </button>
                                    {answerErrors[q.id] && <p role="alert" className="mb-0 mt-2 text-xs text-red-600">{answerErrors[q.id]}</p>}
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>
            )}
            {!sample.content && !(skill === 'speaking' && sample.parts?.length > 0) && (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <p style={{ color: 'var(--subtle)', fontSize: 16, fontStyle: 'italic' }}>Nội dung bài mẫu đang được cập nhật...</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <style>{`
        .rich-content { overflow-wrap: anywhere; }
        .rich-content { max-width: 78ch; margin-inline: auto; }
        .rich-content h1 { font-size: 1.75rem; font-weight: 900; color: var(--ink); margin: 1.5em 0 0.6em; line-height: 1.3; }
        .rich-content h2 { font-size: 1.5rem; font-weight: 800; color: var(--ink); margin: 1.4em 0 0.5em; line-height: 1.3; }
        .rich-content h3 { font-size: 1.25rem; font-weight: 700; color: var(--ink); margin: 1.3em 0 0.5em; line-height: 1.3; }
        .rich-content p  { margin: 0 0 1.2em; }
        .rich-content ul { list-style: disc; padding-left: 1.8rem; margin: 0.8em 0 1.2em; }
        .rich-content ol { list-style: decimal; padding-left: 1.8rem; margin: 0.8em 0 1.2em; }
        .rich-content li { margin-bottom: 0.5em; }
        .rich-content strong { font-weight: 800; color: var(--text); }
        .rich-content em { font-style: italic; color: var(--muted); }
        .rich-content u  { text-decoration: underline; text-underline-offset: 3px; }
        .rich-content blockquote { border-left: 4px solid var(--border); padding-left: 1.5rem; margin: 1.5em 0; font-style: italic; color: var(--muted); }
        .rich-content img { max-width: 100%; height: auto; border-radius: var(--radius-lg); margin: 1.5em 0; border: 1px solid var(--border-soft); }
      `}</style>
    </div>
  )
}
