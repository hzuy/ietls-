import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'

/**
 * ExamErrorState — unified error & retry UI for exam pages when exam data fails to load.
 *
 * Props:
 *   title        {string}   Card heading (default: 'Không thể tải đề thi')
 *   message      {string}   Informative error message
 *   onRetry      {function} Callback when user clicks 'Thử lại'
 *   onBack       {function} Callback when user clicks 'Quay lại danh sách'
 *   backLabel    {string}   Label for back button (default: 'Quay lại danh sách')
 */
export default function ExamErrorState({
  title = 'Không thể tải đề thi',
  message = 'Đã có lỗi xảy ra hoặc đề thi không tồn tại. Vui lòng kiểm tra lại kết nối mạng và thử lại.',
  onRetry,
  onBack,
  backLabel = 'Quay lại danh sách',
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center flex flex-col items-center anim-fade-up">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500 shadow-sm">
          <AlertCircle className="w-7 h-7 stroke-[2]" />
        </div>

        <h1 className="text-slate-900 text-lg md:text-xl font-bold mb-2 tracking-tight">
          {title}
        </h1>

        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          {message}
        </p>

        <div className="w-full flex flex-col gap-2.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="btn-primary w-full text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{ width: '100%', borderRadius: '12px', padding: '10px 0' }}
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="btn-secondary w-full text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
              style={{ width: '100%', borderRadius: '12px', padding: '10px 0' }}
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              {backLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
