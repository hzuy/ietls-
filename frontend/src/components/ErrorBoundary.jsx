import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 sm:p-10 rounded-xl border border-zinc-200 shadow-xs max-w-md w-full">
            <div className="w-14 h-14 rounded-full bg-error-bg border border-error-border flex items-center justify-center text-error mx-auto mb-6">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 mb-2">
              Đã xảy ra lỗi ngoài mong muốn
            </h1>
            <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
              Xin lỗi, đã có sự cố xảy ra trong quá trình hiển thị trang. Vui lòng tải lại trang để tiếp tục.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full py-2.5 text-sm font-medium rounded-lg"
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
