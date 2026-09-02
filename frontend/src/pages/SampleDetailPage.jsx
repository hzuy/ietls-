import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

import SampleHeader from '../components/SampleHeader'
import { getSample } from '../services/sampleService'
import { sanitizeRichText } from '../utils/sanitizeHtml'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'

const TASK_LABELS = { task1: 'Task 1', task2: 'Task 2', task3: 'Task 3' }

export default function SampleDetailPage({ skill }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sample, setSample] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSample(skill, id)
      .then(data => setSample(data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false))
  }, [id, skill])

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '64px 24px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Đang tải...</div>
    </div>
  )
  if (!sample) return null

  const taskLabel = TASK_LABELS[sample.level] || null
  // Tags đã bỏ khỏi luồng soạn Writing/Speaking Sample → không hiển thị nữa.
  // Dữ liệu tags cũ vẫn còn trong DB, chỉ không render.

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onMouseEnter={e => e.target.style.color = 'var(--primary)'}
          onMouseLeave={e => e.target.style.color = 'var(--muted)'}
        >
          ← Quay lại danh sách
        </button>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', padding: '48px' }}>

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
            {sample.content ? (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(sample.content) }}
                style={{ fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.8, color: 'var(--text)' }}
              />
            ) : skill === 'speaking' && sample.parts?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {sample.parts.map(part => (
                  <div key={part.id} style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-soft)', padding: '20px 24px' }}>
                    <div style={{ marginBottom: 14 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                        {part.title || `Part ${part.partNumber}`}
                      </span>
                      {part.description && (
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', margin: '4px 0 0' }}>{part.description}</p>
                      )}
                    </div>
                    {part.questions?.length > 0 && (
                      <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {part.questions.map((q, qi) => (
                          <li key={q.id} style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text)', lineHeight: 1.6 }}>
                            {q.questionText}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-body)', color: 'var(--subtle)', fontSize: 16, fontStyle: 'italic' }}>Nội dung bài mẫu đang được cập nhật...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rich-content h1 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 900; color: var(--ink); margin: 1.5em 0 0.6em; line-height: 1.3; }
        .rich-content h2 { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--ink); margin: 1.4em 0 0.5em; line-height: 1.3; }
        .rich-content h3 { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--ink); margin: 1.3em 0 0.5em; line-height: 1.3; }
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
