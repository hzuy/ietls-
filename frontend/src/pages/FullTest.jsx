import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/axios'
import Navbar from '../components/Navbar'

const SERVER_BASE = 'http://localhost:3001'

const SKILL_META = {
  reading:   { label: 'Reading',   icon: '📖', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', path: '/reading'   },
  listening: { label: 'Listening', icon: '🎧', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', path: '/listening' },
  writing:   { label: 'Writing',   icon: '✍️', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', path: '/writing'   },
  speaking:  { label: 'Speaking',  icon: '🎤', color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe', path: '/speaking'  },
}

const SKILL_ORDER = ['reading', 'listening', 'writing', 'speaking']

export default function FullTest() {
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // { bookNumber, testNumber, exams }
  const [userProgress, setUserProgress] = useState({}) // key: `${seriesId}_${bookNumber}_${testNumber}` → status

  useEffect(() => {
    api.get('/admin/full-tests').then(r => setTests(r.data)).finally(() => setLoading(false))
    api.get('/full-test/user-progress').then(r => {
      const map = {}
      for (const s of r.data) {
        map[`${s.seriesId}_${s.bookNumber}_${s.testNumber}`] = s
      }
      setUserProgress(map)
    }).catch(() => {})
  }, [])

  // Group tests by bookNumber
  const byBook = tests.reduce((acc, t) => {
    const k = t.bookNumber
    if (!acc[k]) acc[k] = []
    acc[k].push(t)
    return acc
  }, {})
  const sortedBooks = Object.keys(byBook).map(Number).sort((a, b) => a - b)

  const completeness = (exams) => {
    const count = SKILL_ORDER.filter(s => exams[s]).length
    return count
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f4f8' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fff 0%, #eff6ff 50%, #fff 100%)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#eff6ff', border: '1px solid #fecaca' }}>
              📚
            </div>
            <div>
              <h1 className="text-2xl font-extrabold" style={{ color: '#1e3a5f' }}>Luyện đề Cambridge Full Test</h1>
              <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Luyện đầy đủ 4 kỹ năng theo từng bộ đề Cambridge IELTS</p>
            </div>
          </div>
          {!loading && (
            <div className="flex gap-4 mt-4">
              <div className="rounded-xl px-4 py-2 text-sm font-bold" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', color: '#1a56db' }}>
                {sortedBooks.length} cuốn sách
              </div>
              <div className="rounded-xl px-4 py-2 text-sm font-bold" style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', color: '#1a56db' }}>
                {tests.length} full tests
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Đang tải...</div>
        ) : sortedBooks.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-bold text-gray-600 mb-1">Chưa có full test nào</p>
            <p className="text-sm text-gray-400">Admin cần gắn nhãn Cambridge cho các đề khi tạo</p>
          </div>
        ) : (
          <div className="space-y-10">
            {sortedBooks.map(bookNum => {
              const bookCover = byBook[bookNum][0]?.coverImageUrl
              return (
              <div key={bookNum}>
                {/* Book heading */}
                <div className="flex items-center gap-4 mb-4">
                  {bookCover ? (
                    <img
                      src={`${SERVER_BASE}${bookCover}`}
                      alt={`Cambridge ${bookNum}`}
                      className="w-12 h-16 rounded-xl object-cover shrink-0 shadow-md"
                      style={{ border: '1px solid #fecaca' }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0" style={{ backgroundColor: '#1a56db' }}>
                      {bookNum}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-extrabold" style={{ color: '#1e3a5f' }}>Cambridge IELTS {bookNum}</h2>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#eff6ff', color: '#1a56db', border: '1px solid #fecaca' }}>
                      {byBook[bookNum].length} test{byBook[bookNum].length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Test cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {byBook[bookNum]
                    .sort((a, b) => a.testNumber - b.testNumber)
                    .map(test => {
                      const done = completeness(test.exams)
                      const isSelected = selected?.bookNumber === bookNum && selected?.testNumber === test.testNumber
                      const progressKey = `${test.seriesId}_${test.bookNumber}_${test.testNumber}`
                      const progress = userProgress[progressKey]
                      const userDoneCount = progress ? SKILL_ORDER.filter(s => progress.skills[s]?.done).length : 0
                      return (
                        <button
                          key={test.testNumber}
                          onClick={() => setSelected(isSelected ? null : test)}
                          className="text-left rounded-2xl p-5 transition-all"
                          style={{
                            backgroundColor: 'white',
                            border: isSelected ? '2px solid #1a56db' : '1px solid #e2e8f0',
                            boxShadow: isSelected ? '0 4px 20px rgba(212,37,37,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.10)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#eff6ff', color: '#1a56db' }}>
                              Test {test.testNumber}
                            </span>
                            {progress?.isComplete ? (
                              <span className="text-sm font-extrabold" style={{ color: '#059669' }}>
                                {progress.overallBand}
                              </span>
                            ) : (
                              <span className="text-xs font-medium" style={{ color: done === 4 ? '#1a56db' : '#8594A3' }}>
                                {done}/4 kỹ năng
                              </span>
                            )}
                          </div>

                          <p className="font-extrabold text-sm mb-3" style={{ color: '#1e3a5f' }}>
                            Cambridge {bookNum} · Test {test.testNumber}
                          </p>

                          {/* Skill indicators */}
                          <div className="flex gap-1.5 mb-3">
                            {SKILL_ORDER.map(skill => {
                              const m = SKILL_META[skill]
                              const available = !!test.exams[skill]
                              const userDone = progress?.skills[skill]?.done
                              return (
                                <div
                                  key={skill}
                                  title={m.label}
                                  className="text-xs px-1.5 py-0.5 rounded font-bold"
                                  style={userDone
                                    ? { backgroundColor: '#dcfce7', color: '#059669', border: '1px solid #86efac' }
                                    : available
                                    ? { backgroundColor: m.bg, color: m.color, border: `1px solid ${m.border}` }
                                    : { backgroundColor: '#F3F4F6', color: '#D1D5DB', border: '1px solid #E5E7EB' }
                                  }
                                >
                                  {m.icon}
                                </div>
                              )
                            })}
                          </div>

                          {/* Progress bar — user completion */}
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(userDoneCount / 4) * 100}%`,
                                backgroundColor: progress?.isComplete ? '#059669' : '#1a56db'
                              }}
                            />
                          </div>

                          {progress?.isComplete ? (
                            <p className="text-xs mt-2 font-semibold" style={{ color: '#059669' }}>
                              Đã hoàn thành ✓
                            </p>
                          ) : userDoneCount > 0 ? (
                            <p className="text-xs mt-2 font-semibold" style={{ color: '#8594A3' }}>
                              Đã làm: {userDoneCount}/4 kỹ năng
                            </p>
                          ) : (
                            <p className="text-xs mt-2 font-semibold" style={{ color: isSelected ? '#1a56db' : '#8594A3' }}>
                              {isSelected ? 'Thu gọn ↑' : 'Xem chi tiết →'}
                            </p>
                          )}
                        </button>
                      )
                    })}
                </div>

                {/* Detail panel — appears below the row of the selected test */}
                {byBook[bookNum].some(t => selected?.bookNumber === bookNum && selected?.testNumber === t.testNumber) && (
                  <div
                    className="mt-4 rounded-2xl p-6"
                    style={{ backgroundColor: 'white', border: '1px solid #fecaca', boxShadow: '0 4px 20px rgba(212,37,37,0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-extrabold text-base" style={{ color: '#1e3a5f' }}>
                          Cambridge IELTS {selected.bookNumber} · Test {selected.testNumber}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Chọn kỹ năng để bắt đầu luyện tập</p>
                      </div>
                      <div className="flex gap-2">
                        {(() => {
                          const pk = `${selected.seriesId}_${selected.bookNumber}_${selected.testNumber}`
                          const prog = userProgress[pk]
                          return prog?.isComplete ? (
                            <button
                              onClick={() => navigate(`/full-test/result?seriesId=${selected.seriesId}&bookNumber=${selected.bookNumber}&testNumber=${selected.testNumber}`)}
                              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                              style={{ backgroundColor: '#059669' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#047857'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#059669'}
                            >
                              Xem kết quả Full Test
                            </button>
                          ) : null
                        })()}
                        <button
                          onClick={() => {
                            const first = SKILL_ORDER.find(s => selected.exams[s])
                            if (first) navigate(`${SKILL_META[first].path}/${selected.exams[first].id}`)
                          }}
                          className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                          style={{ backgroundColor: '#1a56db' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#1a56db'}
                        >
                          Bắt đầu ngay →
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {SKILL_ORDER.map(skill => {
                        const m = SKILL_META[skill]
                        const exam = selected.exams[skill]
                        return (
                          <div
                            key={skill}
                            className="rounded-xl p-4"
                            style={{
                              border: exam ? `1px solid ${m.border}` : '1px solid #E5E7EB',
                              backgroundColor: exam ? m.bg : '#F9FAFB',
                            }}
                          >
                            <div className="text-2xl mb-2">{m.icon}</div>
                            <p className="font-bold text-sm mb-0.5" style={{ color: exam ? m.color : '#9CA3AF' }}>{m.label}</p>
                            {exam ? (
                              <>
                                <p className="text-xs mb-3 leading-relaxed" style={{ color: '#6B7280' }} title={exam.title}>
                                  {exam.title.length > 35 ? exam.title.slice(0, 35) + '…' : exam.title}
                                </p>
                                <button
                                  onClick={() => navigate(`${m.path}/${exam.id}`)}
                                  className="w-full py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                                  style={{ backgroundColor: m.color }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                  Làm bài
                                </button>
                              </>
                            ) : (
                              <p className="text-xs italic" style={{ color: '#9CA3AF' }}>Chưa có đề</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
