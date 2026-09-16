import { Link } from 'react-router-dom'
import { FolderArchive, Library, BarChart2 } from 'lucide-react'
import Card from '../components/common/Card'

// Lối đi gợi ý tới 3 khu vực chính — không phải danh sách đầy đủ điều hướng,
// chỉ chọn nơi người học thường muốn quay lại nhất khi lỡ vào một đường dẫn hỏng.
const SUGGESTIONS = [
  {
    to: '/full-test',
    icon: FolderArchive,
    label: 'Luyện đề thi',
    desc: 'Full Test, Cambridge, Practice Test Plus',
    colorVar: '--skill-r-color',
    bgVar: '--skill-r-bg',
  },
  {
    to: '/writing-samples',
    icon: Library,
    label: 'Thư viện bài mẫu',
    desc: 'Bài mẫu Writing & Speaking điểm cao',
    colorVar: '--skill-w-color',
    bgVar: '--skill-w-bg',
  },
  {
    to: '/progress',
    icon: BarChart2,
    label: 'Tiến độ học tập',
    desc: 'Band điểm, chuỗi ngày luyện và lỗi sai',
    colorVar: '--skill-s-color',
    bgVar: '--skill-s-bg',
  },
]

// Minh họa nội tuyến: trang giấy trống lật mở + kính lúp — "đi tìm một trang
// không có trong đề thi". Vẽ bằng stroke đơn sắc theo token màu nhấn, không tải ảnh ngoài.
function NotFoundIllustration() {
  return (
    <svg
      viewBox="0 0 220 180"
      width="200"
      height="164"
      fill="none"
      aria-hidden="true"
      className="mx-auto"
    >
      <ellipse cx="110" cy="160" rx="64" ry="10" fill="var(--primary-light)" />

      {/* Trang giấy bên trái, hơi lật */}
      <g transform="rotate(-8 70 90)">
        <rect x="34" y="46" width="72" height="92" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="2" />
        <line x1="46" y1="66" x2="94" y2="66" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="80" x2="94" y2="80" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="94" x2="78" y2="94" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Trang giấy bên phải với dấu ? — trang không tìm thấy */}
      <g transform="rotate(6 140 88)">
        <rect x="106" y="42" width="72" height="92" rx="6" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
        <text x="142" y="102" textAnchor="middle" fontSize="46" fontWeight="800" fill="var(--primary)" fontFamily="var(--font-mono)">?</text>
      </g>

      {/* Kính lúp */}
      <g transform="translate(4 -4)">
        <circle cx="151" cy="118" r="22" fill="var(--surface)" stroke="var(--primary)" strokeWidth="4" />
        <line x1="167" y1="134" x2="184" y2="151" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Chấm 4 màu kỹ năng, điểm nhấn nhận diện thương hiệu */}
      <circle cx="26" cy="34" r="4" fill="var(--skill-r-color)" />
      <circle cx="196" cy="40" r="4" fill="var(--skill-l-color)" />
      <circle cx="16" cy="130" r="4" fill="var(--skill-w-color)" />
      <circle cx="200" cy="146" r="4" fill="var(--skill-s-color)" />
    </svg>
  )
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center anim-fade-up">
        <NotFoundIllustration />

        <h1 className="mt-6 text-[26px] sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
          Trang này không có trong đề thi
        </h1>
        <p className="mt-3 text-[15px] text-zinc-600 max-w-md mx-auto">
          Đường dẫn bạn vừa mở có thể đã bị đổi tên, xóa hoặc chưa từng tồn tại.
          Chọn một lối đi quen thuộc bên dưới hoặc quay về trang chủ.
        </p>

        <Link to="/" className="btn-primary mt-7 px-8 py-3.5 text-[15px] font-bold no-underline">
          Về trang chủ
        </Link>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          {SUGGESTIONS.map(({ to, icon: Icon, label, desc, colorVar, bgVar }) => (
            <Link key={to} to={to} className="no-underline h-full">
              <Card
                className="h-full p-4 text-left flex flex-col items-start gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-zinc-300"
              >
                <div
                  className="flex items-center justify-center rounded-xl shrink-0"
                  style={{ width: 36, height: 36, background: `var(${bgVar})`, color: `var(${colorVar})` }}
                >
                  <Icon size={18} strokeWidth={2} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-zinc-900">{label}</div>
                  <div className="text-[12.5px] text-zinc-500 mt-0.5">{desc}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
