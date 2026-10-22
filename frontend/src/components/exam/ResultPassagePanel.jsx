import React, { useEffect } from 'react';

export default function ResultPassagePanel({ passage, activePassage, activeLocator }) {
  useEffect(() => {
    if (activeLocator) {
      // Find the element with the highlight class and scroll to it
      const timer = setTimeout(() => {
        const el = document.querySelector('.locator-highlight');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeLocator]);

  if (!passage) return null;

  const renderParagraph = (para, i) => {
    let content = para.charAt(0).toUpperCase() + para.slice(1);

    if (
      activeLocator && 
      activeLocator.passageIndex === activePassage && 
      activeLocator.paragraphIndex === i
    ) {
      const textToHighlight = activeLocator.textToHighlight;
      if (textToHighlight && content.includes(textToHighlight)) {
        // Split the content and wrap the highlighted part in <mark>
        const parts = content.split(textToHighlight);
        content = (
          <>
            {parts[0]}
            <mark className="locator-highlight bg-yellow-200/60 rounded px-1 text-zinc-900 transition-colors shadow-xs">
              {textToHighlight}
            </mark>
            {parts[1]}
          </>
        );
      }
    }

    if (passage.letteredParagraphs) {
      const letter = String.fromCharCode(65 + i);
      return (
        <p key={i} data-para-index={i} className="mb-5">
          <span className="font-bold text-zinc-900 mr-2">{letter}</span>
          {content}
        </p>
      );
    }
    return <p key={i} data-para-index={i} className="mb-5 indent-6">{content}</p>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white px-8 py-6 relative h-full">
      {/* Passage Toolbar */}
      <div className="sticky -top-6 -mx-8 px-8 py-2.5 mb-5 bg-white/95 backdrop-blur-xs border-b border-zinc-100 flex items-center justify-between z-10">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Passage {activePassage + 1}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-zinc-900 text-center mb-1 leading-snug">{passage.title}</h2>
      {passage.subtitle && <p className="text-sm text-zinc-500 text-center mb-2 italic">{passage.subtitle}</p>}
      <div className="w-16 h-0.5 bg-zinc-900 mx-auto mb-6" />
      <div className="text-zinc-800 font-normal text-base leading-relaxed">
        {passage.body
          ? passage.body
              .split(/\n\s*\n|\n/)
              .map(s => s.trim())
              .filter(Boolean)
              .map((para, i) => renderParagraph(para, i))
          : <p className="text-zinc-400 italic text-center">Nội dung bài đọc không khả dụng.</p>
        }
      </div>
    </div>
  );
}
