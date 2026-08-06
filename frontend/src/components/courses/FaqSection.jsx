import { useState } from 'react'
import { faqData } from '../../data/coursesPageData'
import { ChevronDown } from 'lucide-react'

export default function FaqSection() {
  const [activeFaq, setActiveFaq] = useState(0)

  return (
    <section className="faq-section">
      <div className="text-center mb-8 md:mb-10">
        <span className="inline-block text-xs font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-3.5 py-1 rounded-full border border-blue-100 mb-3">
          FAQS
        </span>
        <h2 className="faq-title text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#0B2345] mt-1">
          Thắc mắc thường gặp
        </h2>
      </div>

      <div className="faq-list">
        {faqData.map((item, index) => (
          <div 
            key={index} 
            className={`faq-item rounded-xl transition-all duration-300 ease-in-out ${activeFaq === index ? 'active' : ''}`}
          >
            <button className="faq-header" onClick={() => setActiveFaq(activeFaq === index ? null : index)}>
              <span className="font-semibold text-slate-800">{item.q}</span>
              <span className="faq-icon">
                <ChevronDown className="w-5 h-5 text-slate-500 transition-transform duration-300" />
              </span>
            </button>
            <div className="faq-body">
              <div className="faq-body-inner">
                {item.a.map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
