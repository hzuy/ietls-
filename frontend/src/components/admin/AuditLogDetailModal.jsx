import Modal from '../common/Modal'

// entityType lưu trong DB là tên model Prisma (PascalCase) — map sang nhãn tiếng
// Việt hiển thị; giá trị chưa có trong map (vd model mới thêm sau này) vẫn hiển
// thị được, chỉ rơi về nguyên chuỗi gốc.
export const ENTITY_TYPE_LABEL = {
  Exam: 'Đề thi',
  PracticeExam: 'Đề luyện tập',
  WritingSample: 'Bài mẫu Writing',
  SpeakingSample: 'Bài mẫu Speaking',
  User: 'Người dùng',
  Setting: 'Cài đặt hệ thống',
  Trash: 'Thùng rác',
  ExamSeries: 'Bộ đề',
  BookCover: 'Cuốn sách',
  AuditLog: 'Nhật ký',
}

const ROLE_LABEL = { admin: 'Admin', teacher: 'Teacher', user: 'Học viên' }

export const fmtDateTime = (d) =>
  new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="text-zinc-900 font-medium text-right">{children}</dd>
    </div>
  )
}

// Giá trị 1 khóa metadata — object/array lồng nhau được đệ quy thành danh sách
// cặp khóa-giá trị, KHÔNG bao giờ đổ thẳng JSON.stringify ra giao diện.
function MetadataValue({ value }) {
  if (value === null || value === undefined) return <span className="text-zinc-400">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'Có' : 'Không'}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">—</span>
    if (value.every(v => v === null || typeof v !== 'object')) {
      return <span>{value.map(v => (v === null ? '—' : String(v))).join(', ')}</span>
    }
    return (
      <ul className="space-y-1 list-disc list-inside text-left">
        {value.map((v, i) => (
          <li key={i}><MetadataValue value={v} /></li>
        ))}
      </ul>
    )
  }
  if (typeof value === 'object') return <MetadataList data={value} nested />
  return <span>{String(value)}</span>
}

function MetadataList({ data, nested = false }) {
  const entries = Object.entries(data || {})
  if (entries.length === 0) {
    return nested
      ? <span className="text-zinc-400">—</span>
      : <p className="text-[11px] text-zinc-400 italic">Không có dữ liệu bổ sung</p>
  }
  return (
    <dl className={`space-y-1.5 ${nested ? 'pl-3 mt-1 border-l border-zinc-200 text-left' : ''}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3">
          <dt className="text-zinc-500 shrink-0 font-mono text-[11px]">{k}</dt>
          <dd className="text-zinc-900 font-medium text-right text-[11px]">
            <MetadataValue value={v} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function AuditLogDetailModal({ log, onClose }) {
  return (
    <Modal onClose={onClose} title={`Chi tiết nhật ký #${log.id}`} size="md" className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-900">Chi tiết nhật ký hoạt động</h2>
        <button onClick={onClose} aria-label="Đóng"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 font-bold transition-colors cursor-pointer">✕</button>
      </div>

      <div className="p-5 space-y-4 text-xs">
        <dl className="space-y-2.5">
          <DetailRow label="Thời gian">{fmtDateTime(log.createdAt)}</DetailRow>
          <DetailRow label="Người thực hiện">
            {log.actorType === 'system' ? 'Hệ thống' : (log.actorDisplayName || '—')}
          </DetailRow>
          {log.actorType !== 'system' && (
            <DetailRow label="Email">{log.actorEmail || '—'}</DetailRow>
          )}
          <DetailRow label="Vai trò lúc thực hiện">
            {log.actorType === 'system' ? 'Hệ thống (tự động)' : (ROLE_LABEL[log.actorRole] || log.actorRole || '—')}
          </DetailRow>
          {log.actorType === 'user' && log.actorUserId == null && (
            <DetailRow label="Trạng thái tài khoản">
              <span className="text-amber-600">Không còn tồn tại</span>
            </DetailRow>
          )}
          <DetailRow label="Hành động">{log.actionLabel}</DetailRow>
          <DetailRow label="Nhóm đối tượng">{ENTITY_TYPE_LABEL[log.entityType] || log.entityType}</DetailRow>
          <DetailRow label="Đối tượng">{log.entityLabel || '—'}</DetailRow>
        </dl>

        <div className="pt-3 border-t border-zinc-100">
          <p className="font-semibold text-zinc-700 text-xs mb-2">Dữ liệu bổ sung</p>
          <MetadataList data={log.metadata} />
        </div>
      </div>
    </Modal>
  )
}
