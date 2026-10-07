import { useState, useEffect, useRef } from 'react'
import { parseTranscript } from '../../utils/transcriptParser'
import { User, UserCircle } from 'lucide-react'

export default function ListeningTranscript({ section, audioRef }) {
  const [currentTime, setCurrentTime] = useState(0)
  const listRef = useRef(null)
  const utteranceRefs = useRef([])
  
  // Parse transcript
  const { isScript, blocks, speakerCount } = parseTranscript(section?.transcript)

  // Bind timeupdate
  useEffect(() => {
    const audio = audioRef?.current
    if (!audio) return
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [audioRef])
  
  // Auto-scroll
  const activeIndex = isScript 
    ? blocks.findIndex(u => currentTime >= (u.start || 0) && currentTime <= (u.end || 0))
    : -1

  useEffect(() => {
    if (activeIndex >= 0 && utteranceRefs.current[activeIndex]) {
      utteranceRefs.current[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIndex])

  const handleSeek = (start) => {
    if (audioRef?.current && start != null) {
      audioRef.current.currentTime = start
    }
  }

  if (!section?.transcript) return null

  if (!isScript) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs mt-4">
        <h3 className="text-xl font-bold text-zinc-900 mb-6 tracking-tight">Transcript</h3>
        <div className="text-zinc-800 whitespace-pre-wrap leading-relaxed text-[15px]">
          {section.transcript}
        </div>
      </div>
    )
  }

  const isMonologue = speakerCount <= 1 || section?.number === 2 || section?.number === 4

  if (isMonologue) {
    // 1 Speaker -> Paragraph Mode (Image 1 style)
    return (
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs mt-4">
        <h3 className="text-xl font-bold text-zinc-900 mb-6 tracking-tight">Transcript</h3>
        <div className="space-y-4">
          {blocks.map((b, idx) => {
            const isActive = idx === activeIndex
            return (
              <p 
                key={idx}
                ref={el => utteranceRefs.current[idx] = el}
                onClick={() => handleSeek(b.start)}
                className={`text-[15px] leading-relaxed cursor-pointer transition-colors duration-200 px-2 py-1 -mx-2 rounded-lg ${
                  isActive ? 'bg-amber-100 text-amber-900 font-medium' : 'text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                {b.text}
              </p>
            )
          })}
        </div>
      </div>
    )
  }

  // Multi-Speaker -> Chat Bubble Mode (Image 2 style)
  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-xs mt-4 flex flex-col h-[600px]">
      <h3 className="text-xl font-bold text-zinc-900 mb-6 tracking-tight shrink-0">Transcript</h3>
      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar" ref={listRef}>
        <div className="space-y-2 pb-6">
          {blocks.map((b, idx) => {
            const isActive = idx === activeIndex
            const isLeft = b.speaker !== 'Speaker B' && b.speaker !== 'SPEAKER B' && b.speaker !== 'SPEAKER 2'
            const showAvatar = idx === 0 || blocks[idx - 1].speaker !== b.speaker
            
            return (
              <div 
                key={idx} 
                ref={el => utteranceRefs.current[idx] = el}
                onClick={() => handleSeek(b.start)}
                className={`flex flex-col w-full cursor-pointer transition-opacity ${isLeft ? 'items-start' : 'items-end'} ${showAvatar ? 'mt-6' : 'mt-1'}`}
              >
                {showAvatar && (
                  <span className={`text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 ${isLeft ? 'ml-12' : 'mr-12'}`}>
                    {b.speaker}
                  </span>
                )}
                
                <div className={`flex gap-3 max-w-[85%] ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-9 h-9 shrink-0 flex items-center justify-center ${showAvatar ? 'rounded-full bg-zinc-100 text-zinc-400 border border-zinc-200' : 'opacity-0'}`}>
                    {showAvatar && <User className="w-5 h-5" />}
                  </div>
                  
                  <div 
                    className={`px-5 py-3.5 text-[15px] leading-relaxed transition-all shadow-sm ${
                      isActive 
                        ? 'bg-blue-600 text-white border-transparent' 
                        : 'bg-white border border-zinc-200 text-zinc-800'
                    } ${showAvatar ? (isLeft ? 'rounded-2xl rounded-tl-none' : 'rounded-2xl rounded-tr-none') : 'rounded-2xl'}`}
                  >
                    {b.text}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
