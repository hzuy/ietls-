import girlImg from '../../../../img/img1.jpg'
import girlHappyImg from '../../../../img/img2.jpg'
import { painData, solutionData } from '../../data/coursesPageData'

export default function PainSolutionSection() {
  return (
    <>
      {/* PAIN SECTION */}
      <section className="pain-section text-center">
        <div className="c-container">
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '48px', color: '#0F172A' }}>
            Vấn đề học viên IELTS thường gặp phải
          </h2>
          
          <div className="pain-grid">
            {/* CỘT TRÁI */}
            <div className="pain-col">
              {painData.slice(0, 2).map((item, idx) => (
                <div key={idx} className="pain-card">
                  <div className="pain-icon">{item.icon}</div>
                  <div>
                    <div className="pain-title">{item.title}</div>
                    <div className="pain-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CỘT GIỮA */}
            <div className="pain-img-wrap">
              <img src={girlImg} alt="Vấn đề học viên IELTS" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }} />
              <div className="pain-emoji top-left">😤</div>
              <div className="pain-emoji top-right">😵</div>
              <div className="pain-emoji bottom-left">😤</div>
              <div className="pain-emoji bottom-right">😡</div>
            </div>

            {/* CỘT PHẢI */}
            <div className="pain-col">
              {painData.slice(2, 4).map((item, idx) => (
                <div key={idx} className="pain-card">
                  <div className="pain-icon">{item.icon}</div>
                  <div>
                    <div className="pain-title">{item.title}</div>
                    <div className="pain-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section className="solution-section text-center">
        <div className="c-container">
          <h2 style={{ fontSize: '36px', fontWeight: 700, margin: '0 0 48px 0', color: '#0F172A' }}>
            Giải pháp của chúng tôi
          </h2>
          
          <div className="solution-grid">
            {/* CỘT TRÁI */}
            <div className="solution-col">
              {solutionData.slice(0, 2).map((item, idx) => (
                <div key={idx} className="solution-card">
                  <div className="solution-icon">{item.icon}</div>
                  <div>
                    <div className="solution-title">{item.title}</div>
                    <div className="solution-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CỘT GIỮA */}
            <div style={{ textAlign: 'center' }}>
              <div className="solution-img-wrap">
                <span className="sol-emoji top-left">🌟</span>
                <span className="sol-emoji top-right">🎯</span>
                <span className="sol-emoji bottom-left">💡</span>
                <span className="sol-emoji bottom-right">🏆</span>
                <img src={girlHappyImg} alt="Giải pháp" style={{ width: '100%', borderRadius: '24px', display: 'block' }} />
              </div>
            </div>

            {/* CỘT PHẢI */}
            <div className="solution-col">
              {solutionData.slice(2, 4).map((item, idx) => (
                <div key={idx} className="solution-card">
                  <div className="solution-icon">{item.icon}</div>
                  <div>
                    <div className="solution-title">{item.title}</div>
                    <div className="solution-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
