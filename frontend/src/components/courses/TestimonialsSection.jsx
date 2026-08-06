import { testimonialsData } from '../../data/coursesPageData'
import { MessageSquare, Sparkles, Quote } from 'lucide-react'

export default function TestimonialsSection() {
  const leftCol = testimonialsData.filter((_, idx) => idx % 2 === 0)
  const rightCol = testimonialsData.filter((_, idx) => idx % 2 === 1)

  return (
    <section className="testimonials-section section-py text-center">
      <div className="c-container">
        <div className="section-header flex flex-col items-center" style={{ marginBottom: '40px' }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-slate-600 stroke-[1.75]" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-slate-600 stroke-[1.75]" />
            </div>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: '700', margin: 0, lineHeight: 1.4 }}>
            Học viên nói gì khi<br />học tại IELTSPro
          </h2>
        </div>

        <div className="review-grid">
          {/* Cột Trái */}
          <div className="review-col">
            {leftCol.map(item => (
              <div key={item.id} className="review-card">
                <div>
                  <div className="review-quote">
                    <Quote className="w-6 h-6 text-slate-300 stroke-[1.75]" />
                  </div>
                  {item.quoteType === 'dialogue' ? (
                    <div className="review-text">
                      {item.dialogue.map((line, dIdx) => (
                        <p key={dIdx} style={{ margin: 0, marginBottom: dIdx < item.dialogue.length - 1 ? 8 : 0 }}>
                          <strong>{line.speaker}</strong> {line.text}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="review-text">{item.quote}</div>
                  )}
                </div>
                <div className="review-footer">
                  <div>
                    <div className="review-label">HỌC VIÊN</div>
                    <div className="review-author">
                      <div className="review-avatar">{item.avatarText}</div>
                      <div>
                        <div className="review-name">{item.name}</div>
                        <div className="review-sub">{item.sub}</div>
                      </div>
                    </div>
                  </div>
                  {item.band && (
                    <div className="review-band">
                      {item.band} <span>Overall</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Cột Phải */}
          <div className="review-col">
            {rightCol.map(item => (
              <div key={item.id} className="review-card">
                <div>
                  <div className="review-quote">
                    <Quote className="w-6 h-6 text-slate-300 stroke-[1.75]" />
                  </div>
                  {item.quoteType === 'dialogue' ? (
                    <div className="review-text">
                      {item.dialogue.map((line, dIdx) => (
                        <div key={dIdx} style={{ marginBottom: dIdx < item.dialogue.length - 1 ? 12 : 0 }}>
                          <strong>{line.speaker}</strong> {line.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="review-text">{item.quote}</div>
                  )}
                </div>
                <div className="review-footer">
                  <div>
                    <div className="review-label">HỌC VIÊN</div>
                    <div className="review-author">
                      <div className="review-avatar">{item.avatarText}</div>
                      <div>
                        <div className="review-name">{item.name}</div>
                        <div className="review-sub">{item.sub}</div>
                      </div>
                    </div>
                  </div>
                  {item.band && (
                    <div className="review-band">
                      {item.band} <span>Overall</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
