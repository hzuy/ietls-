import { Brain, Monitor, Target, GraduationCap, Calendar, Star } from 'lucide-react'

export default function HeroSection({
  title = "Khóa IELTS 4.0",
  inputBand = "IELTS 3.0",
  outputBand = "IELTS 4.0",
  description,
  rating = "4.9/5",
  reviews = "10,000+ review",
  teachers,
  teachersText
}) {
  const teacherList = Array.isArray(teachers)
    ? teachers
    : (teachers && typeof teachers === 'object' ? Object.values(teachers) : null)

  const formattedTeachers = teachersText || (
    teacherList && teacherList.length > 0
      ? teacherList.map(t => typeof t === 'string' ? t : (t.shortName || t.name || t.titleName).replace(/^(Cô|Thầy)\s+/, '')).join(', ')
      : 'Tố Nga, Thùy Linh'
  )

  const teacherAvatars = teacherList && teacherList.length > 0
    ? teacherList.map((t, idx) => ({
        src: t.avatar || `https://i.pravatar.cc/100?img=${idx + 1}`,
        alt: typeof t === 'string' ? t : (t.titleName || t.name || `GV ${idx + 1}`)
      }))
    : [
        { src: 'https://i.pravatar.cc/100?img=1', alt: 'GV Tố Nga' },
        { src: 'https://i.pravatar.cc/100?img=2', alt: 'GV Thùy Linh' }
      ]

  return (
    <>
      {/* Hero Header */}
      <section className="cd-hero">
        <span className="cd-badge">IELTS</span>
        <h1 className="cd-hero-title">{title}</h1>
        <div className="cd-meta mb-1">
          <span className="inline-flex items-center gap-0.5 text-amber-400 mr-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400 stroke-1" />
            ))}
          </span>
          <span><b>{rating}</b> · {reviews}</span>
        </div>

        {/* Description paragraph */}
        <p className="text-gray-600 text-sm md:text-base leading-relaxed my-2 max-w-4xl font-normal">
          {description || `Bạn vẫn còn thói quen dịch từng chữ từ tiếng Việt sang tiếng Anh nên nói, viết chậm và thiếu tự nhiên? ${title} với Linearthinking giúp bạn loại bỏ thói quen đó, hình thành cách tư duy trực tiếp bằng tiếng Anh, từ đó đọc hiểu nhanh hơn, giao tiếp và viết câu trôi chảy hơn.`}
        </p>

        {/* 3-Column Info Block */}
        <div className="bg-[#f0f7ff] border border-[#bfdbfe] rounded-2xl p-4 my-2">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-blue-200/80 gap-3 md:gap-0">
            {/* Col 1 */}
            <div className="flex items-center gap-3.5 md:px-4 py-2 md:py-0">
              <div className="w-10 h-10 rounded-xl bg-white text-slate-500 flex items-center justify-center shrink-0 shadow-sm border border-blue-200/60">
                <Brain className="w-5 h-5 text-slate-500 stroke-[1.75]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Phương pháp</span>
                <span className="font-bold text-gray-900 text-sm md:text-base">Linearthinking</span>
              </div>
            </div>

            {/* Col 2 */}
            <div className="flex items-center gap-3.5 md:px-4 py-2 md:py-0">
              <div className="w-10 h-10 rounded-xl bg-white text-slate-500 flex items-center justify-center shrink-0 shadow-sm border border-blue-200/60">
                <Monitor className="w-5 h-5 text-slate-500 stroke-[1.75]" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Hình thức học</span>
                <span className="font-bold text-gray-900 text-sm md:text-base">Học Offline, Online</span>
              </div>
            </div>

            {/* Col 3 */}
            <div className="flex items-center gap-3.5 md:px-4 py-2 md:py-0">
              <div className="w-10 h-10 rounded-xl bg-white text-slate-500 flex items-center justify-center shrink-0 shadow-sm border border-blue-200/60">
                <Target className="w-5 h-5 text-slate-500 stroke-[1.75]" />
              </div>
              <div className="flex flex-col justify-center gap-0.5">
                <div className="text-xs font-semibold text-gray-600">
                  <span className="text-gray-500 font-medium">Đầu vào:</span> <span className="font-bold text-[#1D4ED8]">{inputBand}</span>
                </div>
                <div className="text-xs font-semibold text-gray-600">
                  <span className="text-gray-500 font-medium">Đầu ra:</span> <span className="font-bold text-emerald-600">{outputBand}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="cd-tagline">Học Tư Duy - Xây lại nền tảng như ý</p>

        <div className="cd-info-bar">
          <div className="cd-info-item min-w-0" title={`Giáo viên: ${formattedTeachers}`}>
            <div className="cd-avatars shrink-0">
              {teacherAvatars.map((a, idx) => (
                <img key={idx} src={a.src} alt={a.alt} className="cd-avatar" />
              ))}
            </div>
            <span className="truncate min-w-0 flex-1">Giáo viên: {formattedTeachers}</span>
          </div>
          <div className="cd-info-item min-w-0" title="Học trên nền tảng IELTSPro">
            <div className="cd-info-icon shrink-0 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </div>
            <span className="truncate min-w-0 flex-1">Học trên nền tảng IELTSPro</span>
          </div>
          <div 
            className="cd-info-item cd-info-btn min-w-0" 
            title="Xem 32 lớp còn chỗ"
            onClick={() => document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <div className="cd-info-icon-small shrink-0 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-slate-500 stroke-[1.75]" />
            </div>
            <span className="truncate min-w-0 flex-1">32 lớp còn chỗ →</span>
          </div>
        </div>
      </section>
    </>
  )
}
