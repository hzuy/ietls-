import { BookOpen, Headphones, FileText, Mic } from 'lucide-react'
import useCountUp from '../../hooks/useCountUp'

// Khối hình ảnh chủ đạo cho hero tối trang chủ (Đợt 3): thẻ Band Score ở tâm
// + 4 vệ tinh icon kỹ năng bay quỹ đạo quanh. Tái dùng hạ tầng orbit/breathe/
// reduced-motion đã có sẵn trong index.css (từng phục vụ bản hero "AI Neural
// Network" cũ, hiện không còn nơi nào dùng) — chỉ đổi nội dung lõi + màu sắc,
// không viết animation mới. Toàn bộ animation chỉ dùng transform/opacity và
// tự tắt khi bật prefers-reduced-motion (xem .hero-net-wrap ở index.css).
const SATELLITES = [
  { Icon: Headphones, x: 281, y: 119, color: 'var(--skill-l-color)', label: 'Listening' },
  { Icon: BookOpen, x: 119, y: 119, color: 'var(--skill-r-color)', label: 'Reading' },
  { Icon: FileText, x: 119, y: 281, color: 'var(--skill-w-color)', label: 'Writing' },
  { Icon: Mic, x: 281, y: 281, color: 'var(--skill-s-color)', label: 'Speaking' },
]

export default function HeroBandOrbit({ band = 8.5 }) {
  const bandDisplay = useCountUp(band, { duration: 1200, decimals: 1 })

  return (
    <div className="hero-net-wrap">
      <svg className="hero-net-svg" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="net-core-grad" cx="35%" cy="30%" r="70%" fx="35%" fy="30%">
            <stop offset="0%" style={{ stopColor: 'var(--net-grad-0)' }} />
            <stop offset="50%" style={{ stopColor: 'var(--net-grad-50)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--net-grad-100)' }} />
          </radialGradient>
          <filter id="net-glow-f" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="net-dot-f" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Quỹ đạo — cả cụm quay CW 30s */}
        <g className="net-orbit">
          <line x1="200" y1="200" x2="281" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="200" y1="200" x2="119" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="200" y1="200" x2="119" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="200" y1="200" x2="281" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="281" y1="119" x2="281" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="281" y1="281" x2="119" y2="281" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="119" y1="281" x2="119" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="119" y1="119" x2="281" y2="119" stroke="var(--net-line-stroke)" strokeWidth="1.5" />
          <line x1="281" y1="119" x2="119" y2="281" stroke="var(--net-line-dim)" strokeWidth="1" strokeDasharray="4 3" />

          {/* Chấm dữ liệu chạy từ tâm ra từng vệ tinh */}
          <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="2.2s" repeatCount="indefinite" path="M200,200 L281,119" />
          </circle>
          <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="2.2s" begin="-1.65s" repeatCount="indefinite" path="M200,200 L119,119" />
          </circle>
          <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="2.2s" begin="-0.55s" repeatCount="indefinite" path="M200,200 L119,281" />
          </circle>
          <circle className="net-flow-dot" r="3" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="2.2s" begin="-1.1s" repeatCount="indefinite" path="M200,200 L281,281" />
          </circle>
          <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="7s" repeatCount="indefinite" path="M281,119 L281,281 L119,281 L119,119 L281,119" />
          </circle>
          <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="7s" begin="-1.75s" repeatCount="indefinite" path="M281,119 L281,281 L119,281 L119,119 L281,119" />
          </circle>
          <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="7s" begin="-3.5s" repeatCount="indefinite" path="M281,119 L281,281 L119,281 L119,119 L281,119" />
          </circle>
          <circle className="net-flow-dot" r="2.5" fill="var(--net-dot-fill)" filter="url(#net-dot-f)">
            <animateMotion dur="7s" begin="-5.25s" repeatCount="indefinite" path="M281,119 L281,281 L119,281 L119,119 L281,119" />
          </circle>

          <circle cx="272" cy="200" r="4.5" fill="var(--net-dec-fill)" />
          <circle cx="200" cy="128" r="4.5" fill="var(--net-dec-fill)" />
          <circle cx="128" cy="200" r="4.5" fill="var(--net-dec-fill)" />
          <circle cx="200" cy="272" r="4.5" fill="var(--net-dec-fill)" />

          {SATELLITES.map(({ Icon, x, y, color, label }) => (
            <g key={label}>
              <circle cx={x} cy={y} r="26" fill="var(--net-node-bg)" stroke="var(--net-node-border)" strokeWidth="1.5" />
              <g className="net-icon-counter">
                <Icon x={x - 12} y={y - 12} width={24} height={24} stroke={color} strokeWidth={2} />
              </g>
            </g>
          ))}
        </g>

        {/* Lõi tĩnh — luôn ở tâm (200,200), không theo quỹ đạo */}
        <g className="net-core-breathe">
          <circle cx="200" cy="200" r="58" fill="var(--net-core-glow)" className="net-glow-halo" filter="url(#net-glow-f)" opacity="0.5" />
          <circle cx="200" cy="200" r="42" fill="url(#net-core-grad)" stroke="var(--net-core-border)" strokeWidth="1.5" />
          <text x="200" y="196" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--net-core-icon)" fontFamily="var(--font-display)">
            {bandDisplay}
          </text>
          <text x="200" y="216" textAnchor="middle" fontSize="9" letterSpacing="1.5" fill="rgba(244,244,245,0.65)" fontFamily="var(--font-mono)">
            BAND SCORE
          </text>
        </g>
      </svg>
    </div>
  )
}
