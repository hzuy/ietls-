import { useState } from 'react'
import { courseSessions } from '../../data/ielts40Data'

export default function CurriculumSection({
  sessions,
  headerMeta = '27 Buổi · 202 Bài học · 54h học tập',
  title = 'Chương trình học 9 tuần',
  unit = 'buổi'
}) {
  const currentSessions = sessions || courseSessions
  const [openSection, setOpenSection] = useState(currentSessions[0]?.id || 1)
  const [showAll, setShowAll] = useState(false)

  const toggleSection = (id) => {
    setOpenSection(prev => (prev === id ? null : id))
  }

  const remaining = currentSessions.length - 4

  return (
    <section>
      <div className="cd-prog-header">
        <h2 className="cd-section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div className="cd-prog-meta">{headerMeta}</div>
      </div>

      <div className="cd-acc">
        {(showAll ? currentSessions : currentSessions.slice(0, 4)).map(session => (
          <div key={session.id} className={`cd-acc-item ${openSection === session.id ? 'open' : ''}`}>
            <div className="cd-acc-header" onClick={() => toggleSection(session.id)}>
              <span className="cd-acc-chevron">▼</span>
              <span className="cd-acc-title">{session.title}</span>
              <span className="cd-acc-duration">{session.duration}</span>
            </div>
            <div className="cd-acc-body">
              <div className="cd-acc-content">
                <div className="cd-acc-inner">
                  {session.lessons && session.lessons.length > 0 ? (
                    session.lessons.map(lesson => (
                      <div key={lesson.num} className="cd-lesson">
                        <div className="cd-lesson-num">{lesson.num}</div>
                        <div className="cd-lesson-title">{lesson.title}</div>
                        <div className="cd-lesson-duration">{lesson.duration}</div>
                      </div>
                    ))
                  ) : (
                    <div className="cd-lesson" style={{ border: 'none', color: 'var(--text-muted)' }}>
                      Nội dung chi tiết sẽ được cập nhật...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {currentSessions.length > 4 && (
        <button className="cd-btn-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Thu gọn ▲' : `Xem thêm ${remaining} ${unit} ▼`}
        </button>
      )}
    </section>
  )
}
