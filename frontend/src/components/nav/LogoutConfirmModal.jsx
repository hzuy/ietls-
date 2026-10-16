import { LogOut } from 'lucide-react'
import Modal from '../common/Modal'

export default function LogoutConfirmModal({ open, onClose, onConfirm, confirmLabel = 'Xác nhận' }) {
  if (!open) return null

  return (
    <Modal onClose={onClose} title="Đăng xuất" size="sm" className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <LogOut className="w-5 h-5 text-red-600" strokeWidth={2} style={{ color: '#dc2626' }} />
        </div>
        <h3 className="font-bold text-red-600 text-base" style={{ color: '#dc2626' }}>Đăng xuất</h3>
      </div>
      <p className="text-sm text-zinc-600 mb-6">
        Bạn có chắc muốn đăng xuất không?
      </p>
      <div className="flex gap-2.5 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-5 rounded-full border border-zinc-200 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 font-medium transition-colors cursor-pointer"
        >
          Huỷ
        </button>
        <button
          type="button"
          onClick={onConfirm}
          style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
          className="h-9 px-5 rounded-full bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
