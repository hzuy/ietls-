import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { getAdminAuditLogs } from '../../services/adminService'
import { AuditLogDetailModal, fmtDateTime } from './AuditLogDetailModal'
import { ChevronDown, History } from 'lucide-react'

const HISTORY_LIMIT = 20

function actorLabel(log) {
  if (log.actorType === 'system') return 'Hệ thống'
  if (log.actorUserId == null) return `${log.actorDisplayName || log.actorEmail || 'Không rõ'} (đã xóa)`
  return log.actorDisplayName || log.actorEmail || 'Không rõ'
}

// Khối "Lịch sử thay đổi" cho form sửa 1 đề Exam (dùng chung Reading/Listening/
// Writing/Speaking — cả 4 đều sửa cùng model Exam, xem backend routes/admin/exams/core.js).
// Chỉ admin được xem (AuditLog là dữ liệu quản trị nhạy cảm) — route form sửa hiện
// dùng StaffRoute (cho cả teacher), nên phải tự chặn ở đây thay vì dựa vào route guard.
export default function ExamAuditHistory({ examId }) {
  const { role } = useAuth()
  const [open, setOpen] = useState(false)
  const [detailLog, setDetailLog] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'auditLogs', 'exam', examId],
    queryFn: () => getAdminAuditLogs({ entityType: 'Exam', entityId: examId, limit: HISTORY_LIMIT }),
    enabled: role === 'admin' && !!examId,
    staleTime: 1000 * 30,
  })

  if (role !== 'admin' || !examId) return null

  const logs = data?.logs || []
  const total = data?.total || 0

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer hover:bg-zinc-50 transition"
      >
        <span className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <History className="w-4 h-4 text-zinc-500" />
          Lịch sử thay đổi{total > 0 ? ` (${total})` : ''}
        </span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-zinc-200 px-6 py-4">
          {isLoading ? (
            <p className="text-xs text-zinc-400">Đang tải…</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Chưa có bản ghi lịch sử nào cho đề thi này — có thể đề được tạo hoặc sửa lần gần nhất trước khi tính năng Nhật ký hoạt động được triển khai, không phải vì chưa từng có thay đổi nào.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {logs.map(log => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => setDetailLog(log)}
                    className="w-full flex items-center justify-between gap-3 py-2.5 text-left cursor-pointer hover:bg-zinc-50 rounded-lg px-2 -mx-2 transition"
                  >
                    <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">{fmtDateTime(log.createdAt)}</span>
                    <span className="text-xs text-zinc-700 flex-1 truncate">{actorLabel(log)}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200 whitespace-nowrap">
                      {log.actionLabel}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 pt-3 border-t border-zinc-100">
            <Link
              to={`/admin/audit-logs?entityType=Exam&entityId=${examId}`}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
            >
              Xem tất cả trong Nhật ký hoạt động
            </Link>
          </div>
        </div>
      )}

      {detailLog && (
        <AuditLogDetailModal log={detailLog} onClose={() => setDetailLog(null)} />
      )}
    </div>
  )
}
