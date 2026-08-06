import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-red-500 mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h1 className="text-[20px] font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Đã xảy ra lỗi ngoài mong muốn
            </h1>
            <p className="text-[14px] text-slate-600 mb-8" style={{ fontFamily: 'var(--font-body)' }}>
              Xin lỗi, đã có sự cố xảy ra trong quá trình hiển thị trang. Vui lòng tải lại trang để tiếp tục.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full py-3.5 text-[14px] font-bold"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
