import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roadmapData } from '../../data/coursesPageData'
import { Lightbulb, Rocket, Target, Check, Calendar, User } from 'lucide-react'

export default function RoadmapSection() {
  const navigate = useNavigate()
  const [activeRoadmap, setActiveRoadmap] = useState(1)
  const [hoverRoadmap, setHoverRoadmap] = useState(null)
  const currentRoadmap = hoverRoadmap !== null ? hoverRoadmap : activeRoadmap

  const tabIcons = [Lightbulb, Rocket, Target]
  const tabLabels = ['Xây nền', 'Tăng tốc', 'Về đích']

  const infoIcons = [Calendar, User, Target]

  return (
    <section id="course-level-roadmap" className="roadmap-section section-py text-center">
      <div className="c-container">
        <div className="section-header">
          <h2>Lộ trình học IELTS theo cấp độ</h2>
        </div>

        <div className="roadmap-tabs">
          {tabLabels.map((label, idx) => {
            const TabIcon = tabIcons[idx]
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                <div 
                  className={`rt-pill ${currentRoadmap === idx ? 'active' : ''}`} 
                  onClick={() => setActiveRoadmap(idx)}
                >
                  <span className="rt-icon flex items-center justify-center">
                    <TabIcon className="w-4 h-4 text-slate-500 stroke-[1.75]" />
                  </span>
                  {label}
                </div>
                {idx < tabLabels.length - 1 && (
                  <div className="rt-arrow">
                    <svg width="140" height="40" viewBox="0 0 140 40" fill="none">
                      <path
                        d="M 0 10 C 30 10, 40 30, 70 30 C 100 30, 110 10, 140 10"
                        stroke="#4D8EFF"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        fill="none"
                        className="dash-line"
                      />
                      <polygon points="132,5 142,10 132,15" fill="#4D8EFF"/>
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid-3" style={{ alignItems: 'stretch' }}>
          {roadmapData.map(card => (
            <div 
              key={card.id}
              className={`roadmap-card ${currentRoadmap === card.id ? 'active' : ''}`} 
              onMouseEnter={() => hoverRoadmap !== card.id && setHoverRoadmap(card.id)} 
              onMouseLeave={() => setHoverRoadmap(null)}
            >
              <h3 className="rm-title">{card.title}</h3>
              <p className="rm-desc">{card.desc}</p>
              
              <span className="rm-label">Mục tiêu</span>
              <ul className="rm-list">
                {card.targets.map((tgt, tIdx) => (
                  <li key={tIdx}>
                    <Check className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 stroke-[2]" />
                    <span>{tgt}</span>
                  </li>
                ))}
              </ul>
              
              <span className="rm-label">Thông tin học tập</span>
              <div className="rm-info-group">
                {card.info.map((inf, iIdx) => {
                  const InfoIcon = infoIcons[iIdx % infoIcons.length]
                  return (
                    <div key={iIdx} className="rm-info">
                      <span className="rm-info-icon flex items-center justify-center">
                        <InfoIcon className="w-4 h-4 text-slate-500 stroke-[1.75]" />
                      </span>
                      {inf.text}
                    </div>
                  )
                })}
              </div>
              
              <span className="rm-label">Khóa học</span>
              <div className="rm-actions">
                {card.actions.map((act, aIdx) => (
                  <button
                    key={aIdx}
                    className="rm-btn group relative overflow-hidden"
                    onClick={() => navigate(act.path)}
                  >
                    <span className="rm-btn-label-normal transition-all duration-800 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:-translate-y-full group-hover:opacity-0">
                      {act.label}
                    </span>
                    <span className="rm-btn-label-hover transition-all duration-800 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-y-0 group-hover:opacity-100">
                      Chi tiết
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
