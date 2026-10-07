import React, { useState, useMemo, useEffect } from 'react'
import { Check, X, RotateCcw, Target, BookOpen, LayoutGrid } from 'lucide-react'
import ResultPassagePanel from './ResultPassagePanel'
import ReviewExplanation from './ReviewExplanation'
import PassagePills from '../PassagePills'
import { formatDisplayAnswer } from '../SkillResult'

function QNum({ num, status }) {
  const c = status === 'correct' ? { bg: 'var(--success)', text: '#fff' } :
            status === 'wrong' ? { bg: 'var(--error)', text: '#fff' } :
            { bg: 'var(--muted)', text: '#fff' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: '50%',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
      background: c.bg, color: c.text,
    }}>
      {num}
    </span>
  )
}

function QuestionResultCard({ q, passageIndex, activeLocator, setActiveLocator }) {
  // Extract evidence locator info if available (v2 format)
  const locateInfo = q.explanation?.locate
  const hasLocator = locateInfo && locateInfo.paragraph != null && q.explanation?.evidence?.parts?.[0]?.text
  
  const idOrNumber = q.id || q.number || (q.grouped && q.numbers ? q.numbers[0] : null)
  const isLocating = activeLocator?.questionId === idOrNumber
  
  const handleLocate = () => {
    if (isLocating) {
      setActiveLocator(null)
    } else if (hasLocator) {
      setActiveLocator({
        questionId: idOrNumber,
        passageIndex,
        paragraphIndex: locateInfo.paragraph,
        textToHighlight: q.explanation.evidence.parts[0].text
      })
    }
  }

  if (q.grouped) {
    const isAllCorrect = q.statuses.every(s => s === 'correct')
    const isAllWrong = q.statuses.every(s => s === 'wrong' || s === 'missed')
    const HeaderColor = isAllCorrect ? 'bg-emerald-50 border-emerald-200' : isAllWrong ? 'bg-red-50 border-red-200' : 'bg-zinc-100 border-zinc-200'
    
    return (
      <div className={`mb-6 bg-white border rounded-2xl overflow-hidden shadow-xs transition-colors ${HeaderColor.split(' ')[1]}`}>
        <div className={`px-4 py-3 flex items-center justify-between border-b ${HeaderColor}`}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {q.numbers.map((n, i) => <QNum key={n} num={n} status={q.statuses?.[i] ?? 'missed'} />)}
              <span className="text-xs text-zinc-500 italic ml-1">In either order</span>
            </div>
            
            <div className="flex flex-col gap-1 mt-1">
              {q.numbers.map((num, i) => {
                const isCorrect = q.statuses?.[i] === 'correct'
                const isWrong = q.statuses?.[i] === 'wrong'
                return (
                  <div key={num} className="flex items-center gap-2 pl-1">
                    <span className="text-xs text-zinc-500 font-medium">Your Answer:</span>
                    <span className={`text-xs font-bold ${isWrong ? 'text-red-600 line-through' : isCorrect ? 'text-emerald-700' : 'text-zinc-500'}`}>
                      {formatDisplayAnswer(q.userAnswers?.[i], q.options) || 'Missed'}
                    </span>
                    {isWrong && (
                      <>
                        <span className="text-xs text-zinc-400">|</span>
                        <span className="text-xs text-zinc-500 font-medium">Correct:</span>
                        <span className="text-xs font-bold text-emerald-700">
                          {formatDisplayAnswer(q.answers?.[i], q.options)}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {hasLocator && (
            <button 
              onClick={handleLocate}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                isLocating 
                  ? 'bg-amber-400 text-amber-900 border border-amber-500' 
                  : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              {isLocating ? 'Đang định vị' : 'Định vị'}
            </button>
          )}
        </div>
        
        <div className="p-4 bg-white">
          <ReviewExplanation explanation={q.explanation} />
        </div>
      </div>
    )
  }

  const isCorrect = q.status === 'correct'
  const isWrong = q.status === 'wrong'
  
  const HeaderColor = isCorrect ? 'bg-emerald-50 border-emerald-200' : isWrong ? 'bg-red-50 border-red-200' : 'bg-zinc-100 border-zinc-200'
  
  return (
    <div className={`mb-6 bg-white border rounded-2xl overflow-hidden shadow-xs transition-colors ${HeaderColor.split(' ')[1]}`}>
      {/* Header bar */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${HeaderColor}`}>
        <div className="flex items-center gap-3">
          <QNum num={q.number} status={q.status} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 font-medium">Your Answer:</span>
              <span className={`text-sm font-bold ${isWrong ? 'text-red-600 line-through' : isCorrect ? 'text-emerald-700' : 'text-zinc-500'}`}>
                {formatDisplayAnswer(q.userAnswer, q.options) || 'Missed'}
              </span>
            </div>
            {isWrong && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-zinc-500 font-medium">Correct:</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatDisplayAnswer(q.correctAnswer, q.options)}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {hasLocator && (
          <button 
            onClick={handleLocate}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer ${
              isLocating 
                ? 'bg-amber-400 text-amber-900 border border-amber-500' 
                : 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            {isLocating ? 'Đang định vị' : 'Định vị'}
          </button>
        )}
      </div>
      
      {/* Explanation Body */}
      <div className="p-4 bg-white">
        <ReviewExplanation explanation={q.explanation} />
      </div>
    </div>
  )
}

export default function ReadingResultSplitScreen({ data, onRetry, isPractice, onClose }) {
  const [activePassage, setActivePassage] = useState(0)
  const [activeLocator, setActiveLocator] = useState(null)
  const [fontSize, setFontSize] = useState('base')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('questions') // 'passage' | 'questions'

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Parse explanation strings to objects
  const sections = useMemo(() => {
    return (data?.sections || []).map(sec => ({
      ...sec,
      questions: (sec.questions || []).map(q => {
        let expObj = q.explanation
        if (typeof expObj === 'string') {
          try { expObj = JSON.parse(expObj) } catch (e) {}
        }
        return { ...q, explanation: expObj }
      })
    }))
  }, [data?.sections])

  const passage = sections[activePassage]
  const passagePillsItems = sections.map((s, i) => ({
    label: `Passage ${s.number}`,
    status: 'default'
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-50 relative">
      {/* Top Navigation Bar */}
      <div className="shrink-0 h-14 px-4 bg-white border-b border-zinc-200 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Làm lại
          </button>
          {!isMobile && (
            <PassagePills
              items={passagePillsItems}
              activeIndex={activePassage}
              onChange={setActivePassage}
            />
          )}
        </div>
        
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileView(v => (v === 'passage' ? 'questions' : 'passage'))}
            className="flex items-center gap-1.5 h-9 px-4 rounded-full bg-zinc-900 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            {mobileView === 'passage'
              ? <><LayoutGrid className="w-4 h-4" /><span>Giải thích</span></>
              : <><BookOpen className="w-4 h-4" /><span>Bài đọc</span></>}
          </button>
        )}
        
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <span className="text-[10px] uppercase font-bold text-zinc-400">Độ chính xác</span>
             <span className="text-sm font-bold text-zinc-900">{data?.totalQuestions ? Math.round((data.correct / data.totalQuestions) * 100) : 0}%</span>
           </div>
           
           {onClose && (
             <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 flex items-center justify-center transition cursor-pointer ml-2"
              >
                <X className="w-4 h-4" />
             </button>
           )}
        </div>
      </div>

      {isMobile && mobileView === 'passage' && (
        <div className="px-4 py-2 bg-white border-b border-zinc-100 shrink-0">
          <PassagePills
            items={passagePillsItems}
            activeIndex={activePassage}
            onChange={setActivePassage}
          />
        </div>
      )}

      {/* Split Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Passage */}
        <div className={`overflow-hidden bg-white border-r border-zinc-200 flex flex-col ${isMobile ? (mobileView === 'passage' ? 'w-full' : 'hidden') : 'w-1/2'}`}>
          <ResultPassagePanel
            passage={passage}
            activePassage={activePassage}
            fontSize={fontSize}
            setFontSize={setFontSize}
            activeLocator={activeLocator}
          />
        </div>

        {/* Right Column: Questions & Explanations */}
        <div className={`overflow-y-auto bg-zinc-50 flex flex-col ${isMobile ? (mobileView === 'questions' ? 'w-full' : 'hidden') : 'w-1/2'}`}>
          <div className="p-6 max-w-3xl mx-auto w-full">
            <h3 className="text-xl font-bold text-zinc-900 mb-6">Phân tích đáp án chi tiết</h3>
            
            {passage?.questions?.map(q => (
              <QuestionResultCard 
                key={q.id || q.number} 
                q={q} 
                passageIndex={activePassage} 
                activeLocator={activeLocator}
                setActiveLocator={setActiveLocator}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
