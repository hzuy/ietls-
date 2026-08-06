import SkeletonBase from './SkeletonBase'

/**
 * SkeletonExamPage — full-screen skeleton for exam pages while the exam data loads.
 * Matches the general 2-column exam layout (passage/audio + answer sheet).
 *
 * Props:
 *   variant  {'default'|'speaking'}  'speaking' shows a single-column card layout.
 */
export default function SkeletonExamPage({ variant = 'default' }) {
  if (variant === 'speaking') {
    return (
      <div className="min-h-screen bg-slate-50 animate-pulse">
        {/* Navbar placeholder */}
        <div className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4">
          <SkeletonBase className="h-6 w-32 rounded" />
          <div className="flex-1" />
          <SkeletonBase className="h-8 w-24 rounded-xl" />
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <SkeletonBase className="h-8 w-48 rounded-lg" />
          <SkeletonBase className="h-4 w-64 rounded" />
          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
            <SkeletonBase className="h-5 w-40 rounded" />
            <SkeletonBase className="h-32 w-full rounded-xl" />
            <SkeletonBase className="h-10 w-32 rounded-xl" />
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-8 space-y-4">
            <SkeletonBase className="h-5 w-36 rounded" />
            {[1, 2, 3].map(i => (
              <SkeletonBase key={i} className="h-4 rounded" style={{ width: `${70 + i * 8}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Default: 2-column Reading / Listening / Writing / Practice layout
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Navbar placeholder */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-4">
        <SkeletonBase className="h-5 w-28 rounded" />
        <div className="flex-1" />
        <SkeletonBase className="h-8 w-24 rounded-xl" />
        <SkeletonBase className="h-8 w-20 rounded-xl" />
      </div>

      {/* Two-column body */}
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left pane — passage / audio */}
        <div className="flex-1 border-r border-gray-100 p-6 space-y-4 overflow-hidden">
          <SkeletonBase className="h-6 w-40 rounded-lg" />
          <SkeletonBase className="h-4 w-56 rounded" />
          <div className="mt-4 space-y-3">
            {[100, 90, 95, 80, 100, 85, 92, 78, 96, 88].map((w, i) => (
              <SkeletonBase key={i} className="h-3.5 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="space-y-3 pt-2">
            {[88, 95, 72, 100, 84].map((w, i) => (
              <SkeletonBase key={i} className="h-3.5 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        {/* Right pane — questions */}
        <div className="w-[380px] shrink-0 p-6 space-y-5 overflow-hidden">
          <SkeletonBase className="h-5 w-36 rounded" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <SkeletonBase className="h-3.5 w-48 rounded" />
              <div className="space-y-1.5 pl-3">
                {['A', 'B', 'C', 'D'].map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <SkeletonBase className="w-4 h-4 rounded-full shrink-0" />
                    <SkeletonBase className={`h-3 rounded ${opt === 'A' ? 'w-40' : opt === 'B' ? 'w-32' : opt === 'C' ? 'w-36' : 'w-28'}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
