import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { getSample } from '../services/sampleService'

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'
const resolveUrl = (url) => !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

const TASK_LABELS = { task1: 'Task 1', task2: 'Task 2', task3: 'Task 3' }

const TASK_COLORS = {
  task1: { bg: '#eff6ff', color: '#1a56db' },
  task2: { bg: '#f0fdf4', color: '#15803d' },
  task3: { bg: '#fdf4ff', color: '#7c3aed' },
}

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
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-400">Đang tải...</div>
    </div>
  )
  if (!sample) return null

  const taskStyle = TASK_COLORS[sample.level] || null
  const taskLabel = TASK_LABELS[sample.level] || null
  const tags = sample.tags || []

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Quay lại
        </button>

        <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          {/* Thumbnail */}
          {resolveUrl(sample.thumbnailUrl) && (
            <div style={{ width: '100%', aspectRatio: '21/9', overflow: 'hidden' }}>
              <img
                src={resolveUrl(sample.thumbnailUrl)}
                alt={sample.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div style={{ padding: '28px 32px' }}>
            {/* Meta row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: skill === 'writing' ? '#1a56db' : '#7c3aed', textTransform: 'uppercase' }}>
                {skill === 'writing' ? 'Writing Sample' : 'Speaking Sample'}
              </span>
              {taskLabel && taskStyle && (
                <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '2px 10px', background: taskStyle.bg, color: taskStyle.color }}>
                  {taskLabel}
                </span>
              )}
              {sample.examType && (
                <span style={{ fontSize: 12, fontWeight: 500, borderRadius: 6, padding: '2px 10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                  {sample.examType}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', marginBottom: 16, lineHeight: 1.35 }}>
              {sample.title}
            </h1>

            {/* Tags */}
            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                {tags.map(t => (
                  <span key={t} style={{
                    fontSize: 12, fontWeight: 500, borderRadius: 20, padding: '3px 12px',
                    background: skill === 'writing' ? '#eff6ff' : '#f5f3ff',
                    color: skill === 'writing' ? '#1a56db' : '#7c3aed',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 24 }} />

            {/* Content */}
            {sample.content ? (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: sample.content }}
                style={{ fontSize: 15, lineHeight: 1.85, color: '#374151' }}
              />
            ) : (
              <p style={{ color: '#94a3b8', fontSize: 14 }}>Chưa có nội dung.</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .rich-content h1 { font-size: 1.5rem; font-weight: 800; color: #1e3a5f; margin: 1.2em 0 0.5em; }
        .rich-content h2 { font-size: 1.25rem; font-weight: 700; color: #1e3a5f; margin: 1.1em 0 0.4em; }
        .rich-content h3 { font-size: 1.1rem; font-weight: 700; color: #374151; margin: 1em 0 0.4em; }
        .rich-content p  { margin: 0 0 0.9em; }
        .rich-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5em 0 0.9em; }
        .rich-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5em 0 0.9em; }
        .rich-content li { margin-bottom: 0.3em; }
        .rich-content strong { font-weight: 700; }
        .rich-content em { font-style: italic; }
        .rich-content u  { text-decoration: underline; }
      `}</style>
    </div>
  )
}
