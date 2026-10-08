import React from 'react'
import PillButton from './common/PillButton'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
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
            <p className="text-sm text-zinc-600 mb-2 leading-relaxed">
              Xin lỗi, đã có sự cố xảy ra trong quá trình hiển thị trang. Vui lòng tải lại trang để tiếp tục.
            </p>
            <pre className="text-left text-xs bg-gray-100 p-2 overflow-auto max-h-64 mb-6 text-red-500 font-mono break-words whitespace-pre-wrap">
              {this.state.error && this.state.error.message}
              {"\n"}
              {this.state.error && this.state.error.stack}
            </pre>
            <PillButton onClick={() => window.location.reload()} fullWidth>
              Tải lại trang
            </PillButton>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
