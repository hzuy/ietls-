import GatedLink from './common/GatedLink'

const NAV_LINKS = [
  { label: 'IELTS Full Test', to: '/full-test' },
  { label: 'Practice Plus', to: '/practice-plus' },
  { label: 'Reading', to: '/practice/reading' },
  { label: 'Listening', to: '/practice/listening' },
  { label: 'Bài mẫu Writing', to: '/writing-samples' },
  { label: 'Bài mẫu Speaking', to: '/speaking-samples' },
]

function FooterLink({ to, children }) {
  return (
    <GatedLink
      to={to}
      className="footer-link text-[13px]"
      style={{ textDecoration: 'none' }}
    >
      {children}
    </GatedLink>
  )
}

// Chân trang tối giản một dòng (Đợt 5): bỏ lưới 4 cột + tagline quảng cáo kiểu
// SaaS/e-commerce ("Product" heading, "giúp bạn đạt band score mục tiêu nhanh
// hơn...") — chỉ giữ đúng 3 thứ bắt buộc (thương hiệu, điều hướng nội bộ, bản
// quyền) trên một hàng, tự xuống dòng ở màn hình hẹp qua flex-wrap thay vì
// dàn thành các cột riêng.
//
// justify-between (dàn brand/nav/copyright sát 2 mép) chỉ bật từ `lg:` — dưới
// mốc đó container không còn bị `max-w-6xl` giới hạn nên nội dung hàng cuối
// (link/copyright) sẽ áp sát mép phải thật của viewport, đúng góc mà nút
// chatbot nổi toàn site (AIChatbotDrawer, fixed bottom-6 right-6, ~52px) luôn
// đứng — khi cuộn hết trang (footer là phần tử cuối) hai thứ đè lên nhau, che
// chữ. Giữ layout "center + nav xuống dòng riêng" tới hết `lg` để không có gì
// áp sát mép ngang đó.
//
// pb-24 (KHÔNG hạ lại ở breakpoint nào, kể cả khi justify-between bật ở lg)
// vì lề ngang do max-w-6xl tạo ra chỉ đủ lớn để né nút chatbot từ khoảng
// ~1280px trở lên (đã đo bằng Playwright: ở đúng 1024px — biên lg — copyright
// vẫn đè trúng nút vì lề lúc đó chỉ ~12px, không đủ). Dùng khoảng đệm DƯỚI cố
// định thay vì né theo lề NGANG: nút chỉ chiếm 24-76px tính từ đáy viewport,
// pb-24 (96px) đảm bảo hàng cuối luôn nằm cao hơn mép trên của nút ~20px, bất
// kể độ rộng màn hình — tránh phải dò lại từng breakpoint mỗi khi nội dung
// hàng cuối thay đổi.
export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 pt-5 pb-24 flex flex-wrap items-center justify-center lg:justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
          </div>
          <span className="font-bold text-[15px] text-white tracking-[-0.01em]">
            IELTS<span className="text-zinc-400 font-medium">Pro</span>
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 order-3 lg:order-none w-full lg:w-auto">
          {NAV_LINKS.map(l => (
            <FooterLink key={l.to} to={l.to}>{l.label}</FooterLink>
          ))}
        </nav>

        <span className="text-zinc-500 text-[12px] whitespace-nowrap shrink-0">
          © 2026 IELTSPro
        </span>
      </div>
    </footer>
  )
}
