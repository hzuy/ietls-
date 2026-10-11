import { History } from 'lucide-react'

export default function PastAttemptBanner({ finishedAt }) {
  return (
    <div
      role="status"
      className="mb-6 rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}
    >
      <History className="w-4 h-4 shrink-0" />
      <p className="m-0 text-sm">
        Bạn đang xem lại lượt làm bài trước đó
        {finishedAt && ` — ${new Date(finishedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
      </p>
    </div>
  )
}
