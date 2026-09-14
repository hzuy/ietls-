import ExamActionDialog from './ExamActionDialog'

/**
 * ExitConfirmModal — hộp thoại xác nhận khi người dùng bấm Back (<) để rời khỏi
 * phòng thi. Preset nội dung cố định trên nền khung dùng chung ExamActionDialog
 * (cùng khung/cỡ nút với hộp thoại "Nộp bài?" — xem ExamActionDialog.jsx).
 *
 * Props:
 *   open     — boolean, hiển thị/ẩn modal
 *   onStay   — () => void, khi bấm "Ở lại"
 *   onLeave  — () => void, khi bấm "Thoát"
 */
export default function ExitConfirmModal({ open, onStay, onLeave }) {
  return (
    <ExamActionDialog
      open={open}
      title="Rời khỏi phòng thi?"
      description="Tiến trình được lưu tự động dạng làm dở. Bạn có chắc muốn thoát?"
      cancelLabel="Ở lại"
      confirmLabel="Thoát"
      onCancel={onStay}
      onConfirm={onLeave}
    />
  )
}
