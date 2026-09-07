import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Send, X, RotateCcw, Bot, AlertCircle } from 'lucide-react'
import { sendChatMessage } from '../../services/chatbotService'
import { useAuth } from '../../context/AuthContext'

/**
 * Custom Markdown Renderer for IELTS AI Tutor responses
 * Styles headings, tables, lists, code, and text to match Shadcn / Zinc monochrome design tokens.
 */
function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed my-1 first:mt-0 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-950 dark:text-zinc-50">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-zinc-800 dark:text-zinc-200">
            {children}
          </em>
        ),
        ul: ({ children }) => (
          <ul className="pl-4 space-y-1 my-1 list-disc text-xs text-zinc-800 dark:text-zinc-200">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="pl-4 space-y-1 my-1 list-decimal text-xs text-zinc-800 dark:text-zinc-200">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
            {children}
          </li>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full border-collapse text-[11px] text-zinc-800 dark:text-zinc-200">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
            {children}
          </thead>
        ),
        th: ({ children }) => (
          <th className="p-1.5 text-left font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="p-1.5 border-t border-zinc-200 dark:border-zinc-800">
            {children}
          </td>
        ),
        pre: ({ children }) => (
          <pre className="p-2 my-1.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[11px] overflow-x-auto">
            {children}
          </pre>
        ),
        code: ({ children, className }) => {
          if (className) {
            return <code className="font-mono text-[11px]">{children}</code>
          }
          return (
            <code className="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700 font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
              {children}
            </code>
          )
        },
        h1: ({ children }) => (
          <h1 className="text-sm font-bold text-zinc-950 dark:text-zinc-50 my-1.5 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xs font-bold text-zinc-950 dark:text-zinc-50 my-1.5 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xs font-semibold text-zinc-950 dark:text-zinc-50 my-1 first:mt-0">
            {children}
          </h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-2.5 my-1 italic text-zinc-600 dark:text-zinc-400 text-xs">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-900 dark:text-zinc-100 underline hover:opacity-80"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/**
 * Global helper to trigger AI Tutor drawer from anywhere
 * @param {string} prompt - Optional prompt to automatically send or prepopulate
 */
export function askAITutor(prompt) {
  window.dispatchEvent(new CustomEvent('open-ai-tutor', { detail: { prompt } }))
}

/**
 * Detect context from current location to provide tailored academic chips and banner
 */
export function detectPageContext(pathname, search) {
  const isSample =
    pathname.startsWith('/samples') ||
    pathname.startsWith('/writing-samples') ||
    pathname.startsWith('/speaking-samples')

  const isResult =
    pathname.includes('/result') ||
    pathname.startsWith('/progress') ||
    search.includes('viewResult=true')

  if (isSample) {
    let name = 'Bài mẫu Học thuật'
    if (pathname.includes('/writing') || pathname.startsWith('/writing-samples')) {
      name = 'Bài mẫu Writing'
    } else if (pathname.includes('/speaking') || pathname.startsWith('/speaking-samples')) {
      name = 'Bài mẫu Speaking'
    }

    return {
      type: 'sample',
      name,
      chips: [
        'Phân tích cấu trúc đoạn văn bài mẫu này',
        'Liệt kê từ vựng và Collocations Band 8.0+',
        'Cách áp dụng ý tưởng này vào đề tương tự',
      ],
    }
  }

  if (isResult) {
    let name = 'Phân tích Kết quả & Lịch sử'
    if (pathname.includes('/reading')) name = 'Kết quả & Lỗi sai Reading'
    else if (pathname.includes('/listening')) name = 'Kết quả & Lỗi sai Listening'
    else if (pathname.includes('/writing')) name = 'Kết quả & Nhận xét Writing'
    else if (pathname.includes('/speaking')) name = 'Kết quả & Nhận xét Speaking'
    else if (pathname.startsWith('/progress')) name = 'Tiến độ & Phân tích Năng lực'

    return {
      type: 'result',
      name,
      chips: [
        'Giải thích lỗi sai ở câu làm sai nhiều nhất',
        'Lập kế hoạch khắc phục điểm yếu tiêu chí Lexical Resource',
        'Phân biệt cụ thể True / False / Not Given trong bài vừa làm',
      ],
    }
  }

  // General pages
  let name = 'Tổng quan Khảo thí'
  if (pathname.startsWith('/cambridge') || pathname.startsWith('/full-test')) name = 'Phòng thi Cambridge Full Test'
  else if (pathname.startsWith('/practice/reading')) name = 'Luyện tập Reading'
  else if (pathname.startsWith('/practice/listening')) name = 'Luyện tập Listening'
  else if (pathname.startsWith('/profile')) name = 'Hồ sơ Cá nhân'

  return {
    type: 'general',
    name,
    chips: [
      'Phân biệt Not Given và False trong IELTS Reading',
      'Tiêu chí đạt Lexical Resource 7.0+ trong Writing',
      'Chiến lược cải thiện cấu trúc bài Writing Task 2',
    ],
  }
}

const INITIAL_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Mình là IELTS AI Tutor. Mình có thể hỗ trợ bạn giải thích bài tập, làm rõ các câu sai, và chia sẻ mẹo nâng band từng kỹ năng. Bạn cần trợ giúp phần nào hôm nay?',
}

export default function AIChatbotDrawer() {
  const { pathname, search } = useLocation()
  const { user } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Context-aware dynamic page context & chips
  const contextInfo = useMemo(() => {
    return detectPageContext(pathname, search)
  }, [pathname, search])

  // Extract page heading/title for prompt injection
  const getContextDetails = () => {
    let title = ''
    try {
      const h1 = document.querySelector('h1')?.textContent?.trim()
      if (h1 && h1 !== 'IELTSPro' && h1.length < 120) {
        title = h1
      } else if (typeof document !== 'undefined' && document.title) {
        title = document.title.replace(' — IELTS Platform', '').replace('IELTS Platform — ', '')
      }
    } catch (_e) {
      // Ignore DOM access issues
    }
    const cleanTitle = (title || contextInfo.name || '').replace(/\s+/g, ' ').trim()
    return {
      pageTitle: cleanTitle.length > 80 ? cleanTitle.slice(0, 80) + '...' : cleanTitle,
    }
  }

  // Determine visibility: hide in admin and during active timed exam without results
  const isResultView = pathname.includes('/result') || search.includes('viewResult=true')
  const isExamInProgress =
    !isResultView &&
    (/^\/(reading|listening|writing|speaking)\/[^/]+/.test(pathname) ||
      /^\/practice\/(reading|listening)\/[^/]+/.test(pathname) ||
      /^\/full-test\/\d+/.test(pathname))

  const shouldHide = pathname.startsWith('/admin') || isExamInProgress

  // Listen for external trigger events (e.g. from SkillResult "Hỏi AI Tutor")
  useEffect(() => {
    const handleOpen = (e) => {
      setIsOpen(true)
      const prompt = e.detail?.prompt
      if (prompt && typeof prompt === 'string') {
        sendMessageInternal(prompt)
      }
    }
    window.addEventListener('open-ai-tutor', handleOpen)
    return () => window.removeEventListener('open-ai-tutor', handleOpen)
  }, [messages, loading])

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE])
    setErrorMsg(null)
  }

  const sendMessageInternal = async (textToSend, displayContent) => {
    const trimmed = textToSend.trim()
    if (!trimmed || loading) return

    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để trò chuyện cùng AI Tutor.')
      return
    }

    const userMsg = {
      id: String(Date.now()),
      role: 'user',
      content: displayContent || trimmed,
      promptText: trimmed,
    }

    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setErrorMsg(null)

    try {
      // Send past messages (excluding welcome message)
      const history = nextMessages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.promptText || m.content }))

      const res = await sendChatMessage(trimmed, history)
      const aiReply = res?.reply || 'Xin lỗi, không có phản hồi từ AI.'

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: aiReply,
        },
      ])
    } catch (err) {
      const status = err.response?.status
      const msg =
        status === 429
          ? (err.response?.data?.message || 'Bạn đã đạt giới hạn 20 tin nhắn/giờ. Vui lòng thử lại sau.')
          : (err.response?.data?.message || 'Không thể kết nối với AI Tutor. Vui lòng thử lại.')
      setErrorMsg(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleChipClick = (chipText) => {
    const details = getContextDetails()
    const contextPrefix = details.pageTitle ? `[Ngữ cảnh: ${details.pageTitle}] ` : ''
    const promptToSend = `${contextPrefix}${chipText}`
    sendMessageInternal(promptToSend, chipText)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMessageInternal(input)
  }

  if (shouldHide) return null

  return (
    <>
      {/* ── 1. Floating Action Button (FAB) ── */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Mở IELTS AI Tutor"
          className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xl border border-zinc-200/40 dark:border-zinc-800 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
        >
          <Sparkles className="w-5 h-5 text-white dark:text-zinc-900 transition-transform group-hover:rotate-12" />
          {/* Online indicator */}
          <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
        </button>
      )}

      {/* ── 2. Chat Drawer / Popover Window ── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Khung trò chuyện IELTS AI Tutor"
          className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-100px)] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/90 backdrop-blur-xs select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                    IELTS AI Tutor
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-medium shrink-0">
                    Llama 3.3
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Sẵn sàng giải đáp</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="Xóa ngữ cảnh hội thoại"
                className="w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center cursor-pointer border-none bg-transparent"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
                className="w-7 h-7 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition flex items-center justify-center cursor-pointer border-none bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context Banner */}
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 select-none shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
            <span className="truncate">
              Đang hỗ trợ ngữ cảnh: <strong className="font-semibold text-zinc-700 dark:text-zinc-300">{contextInfo.name}</strong>
            </span>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {messages.map((m) => {
              const isAi = m.role === 'assistant'
              return (
                <div key={m.id} className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
                  {isAi ? (
                    <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[88%] text-xs leading-relaxed break-words shadow-2xs">
                      <MarkdownRenderer content={m.content} />
                    </div>
                  ) : (
                    <div className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl rounded-tr-xs px-3.5 py-2.5 max-w-[88%] text-xs font-normal whitespace-pre-wrap break-words shadow-2xs">
                      {m.content}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-xs bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Error banner */}
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Context Chips (Only shown when 1 welcome message) */}
          {messages.length === 1 && (
            <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col gap-2">
              <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Gợi ý câu hỏi nhanh:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {contextInfo.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="text-[11px] py-1.5 px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer flex items-center gap-1.5 text-left"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{chip}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer Input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={500}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi AI Tutor về IELTS..."
              className="flex-1 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl px-3.5 py-2 text-xs outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-black dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center cursor-pointer border-none shrink-0 shadow-xs"
              title="Gửi tin nhắn"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
