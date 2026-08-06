import { useState } from 'react'
import { teachersData as defaultTeachersData } from '../../data/ielts40Data'

export default function TeachersSection({ teachers }) {
  const currentTeachers = teachers || defaultTeachersData
  const keys = Object.keys(currentTeachers)
  const [activeKey, setActiveKey] = useState(keys[0] || 1)
  const activeTeacher = currentTeachers[activeKey] || currentTeachers[keys[0]]

  return (
    <section>
      <h2 className="cd-section-title" style={{ fontWeight: 700, marginBottom: 24 }}>Giáo viên khoá IELTS</h2>
      
      <div className="cd-teacher-avatars">
        {keys.map((key) => (
          <div 
            key={key}
            className={`cd-teacher-avatar ${String(activeKey) === String(key) ? 'active' : ''}`}
            onClick={() => setActiveKey(key)}
            style={{ backgroundImage: `url(${currentTeachers[key].avatar || `https://i.pravatar.cc/100?img=${key}`})` }}
          ></div>
        ))}
      </div>

      <div>
        <div className="cd-teacher-header">
          <h3 className="cd-teacher-name">
            <small>{activeTeacher.titlePrefix || 'Thầy'}</small> {activeTeacher.name ? activeTeacher.name.replace(/^(Cô|Thầy)\s+/, '') : ''}
          </h3>
        </div>

        <div className="cd-teacher-info-grid">
          {activeTeacher.features.map((feat, idx) => (
            <div key={idx} className="cd-teacher-info-item">
              <span className="cd-teacher-info-icon">✓</span>
              <span>{feat}</span>
            </div>
          ))}
        </div>

        <div className="cd-teacher-quote-card">
          <div className="cd-teacher-quote-label">
            CHIA SẺ TỪ {activeTeacher.quoteLabel || (activeTeacher.titlePrefix ? activeTeacher.titlePrefix.toUpperCase() : 'THẦY')}
          </div>
          <div className="cd-teacher-quote-body">
            <div className="cd-teacher-quote-avatar" style={{ backgroundImage: `url(${activeTeacher.avatar || `https://i.pravatar.cc/100?img=${activeKey}`})` }}></div>
            <p className="cd-teacher-quote-text">"{activeTeacher.quote}"</p>
          </div>
        </div>
      </div>
    </section>
  )
}
