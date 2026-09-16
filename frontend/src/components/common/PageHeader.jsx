// Tiêu đề trang (h1 + mô tả ngắn) dùng chung — trước đây mỗi trang tự lặp lại
// cặp <h1>/<p> với className gần giống nhau. Luôn truyền className tường minh
// khi trang hiện tại lệch khỏi mặc định, để không đổi diện mạo khi thay thế.
export default function PageHeader({ title, subtitle, className = '', titleClassName, subtitleClassName }) {
  return (
    <div className={className}>
      <h1 className={titleClassName || 'text-2xl font-bold text-zinc-900 tracking-tight'}>
        {title}
      </h1>
      {subtitle && (
        <p className={subtitleClassName || 'text-sm text-zinc-500 mt-1'}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
