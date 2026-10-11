/**
 * HighlightPopovers — UI popovers dùng chung cho mọi trang thi (Reading, Listening, Practice).
 * Thiết kế chuẩn theo giao diện IELTS on Computer (CD IELTS):
 *   1. SelectionBubble — hiện khi bôi chọn văn bản: [ Note | Highlight ] dạng bubble tối giản không icon, có caret chỉ xuống.
 *   2. HighlightMenu   — hiện khi click vào đoạn đã highlight: [ Sửa ghi chú | Xóa ] dạng bubble không icon.
 *   3. NoteEditor      — popover soạn/sửa ghi chú: tab [ Note | Highlight ] ở trên + hộp thoại viền xám ở dưới, nút Lưu & Hủy căn giữa cân đối.
 */
export default function HighlightPopovers({
  selectionBubble,
  highlightMenu,
  noteEditor,
  onApplyHighlight,
  onOpenNote,
  onEditNote,
  onClearHighlight,
  onSaveNote,
  onCancelNote,
  onNoteChange,
}) {
  return (
    <>
      {/* 1. Floating bubble khi bôi chọn: [ Note | Highlight ] */}
      {selectionBubble && (
        <div
          data-highlight-popover
          className="fixed z-[200] -translate-x-1/2 -translate-y-full flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ left: selectionBubble.x, top: selectionBubble.y - 6 }}
        >
          <div className="flex items-center bg-slate-800 text-white rounded-md shadow-md border border-slate-700/60 px-3 py-1">
            <button
              type="button"
              onClick={onOpenNote}
              className="text-[12px] font-medium leading-none text-white hover:underline transition-all cursor-pointer px-1 py-0.5"
            >
              Note
            </button>
            <div className="w-px h-3 bg-slate-600 mx-1.5" />
            <button
              type="button"
              onClick={onApplyHighlight}
              className="text-[12px] font-medium leading-none text-white hover:underline transition-all cursor-pointer px-1 py-0.5"
            >
              Highlight
            </button>
          </div>
          {/* Mũi tên tam giác chỉ xuống văn bản */}
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-800" />
        </div>
      )}

      {/* 2. Menu khi click vào đoạn đã note / highlight: nút Remove note chuẩn CD IELTS */}
      {highlightMenu && (
        <div
          data-highlight-popover
          className="fixed z-[200] -translate-x-1/2 -translate-y-full flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ left: highlightMenu.x, top: highlightMenu.y - 4 }}
        >
          <div className="flex items-center bg-[#1e2530] text-white rounded-md shadow-md border border-slate-700/60 px-3 py-1.5">
            <button
              type="button"
              onClick={() => onClearHighlight(highlightMenu.id)}
              className="text-[13px] font-medium leading-none text-white hover:underline transition-all cursor-pointer whitespace-nowrap px-0.5"
            >
              {highlightMenu.note ? 'Remove note' : 'Clear'}
            </button>
          </div>
          {/* Mũi tên tam giác chỉ xuống đoạn text */}
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#1e2530]" />
        </div>
      )}

      {/* 3. Popover soạn/sửa ghi chú theo mẫu CD IELTS */}
      {noteEditor && (
        <div
          data-highlight-popover
          className="fixed z-[200] -translate-x-1/2 flex flex-col items-center select-none animate-in fade-in zoom-in-95 duration-100"
          style={{ left: noteEditor.x, top: noteEditor.y + 8 }}
        >
          {/* Header tab tối giản [ Note | Highlight ] */}
          <div className="flex items-center bg-slate-800 text-white rounded-t-md px-3 py-1 shadow-sm border border-slate-700/60">
            <span className="text-[12px] font-medium text-white px-1">Note</span>
            <div className="w-px h-3 bg-slate-600 mx-1.5" />
            <span className="text-[12px] font-medium text-white/60 px-1">Highlight</span>
          </div>
          {/* Mũi tên tam giác chỉ xuống hộp thoại */}
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-slate-800" />

          {/* Hộp thoại ghi chú màu trắng */}
          <div className="w-72 sm:w-80 bg-white border border-zinc-300 rounded-lg shadow-lg p-3.5 flex flex-col mt-0.5">
            <textarea
              autoFocus
              rows={3}
              value={noteEditor.value}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Nhập ghi chú..."
              className="w-full text-xs text-zinc-700 bg-white border border-zinc-300 rounded-md p-2.5 resize-none focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 placeholder:text-zinc-400"
            />
            {/* Cụm nút Lưu và Hủy căn giữa cân đối */}
            <div className="flex justify-center items-center gap-3 mt-3">
              <button
                type="button"
                onClick={onSaveNote}
                className="min-w-[72px] px-5 py-1 text-xs font-normal text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 active:bg-zinc-100 shadow-xs transition-colors cursor-pointer"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={onCancelNote}
                className="min-w-[72px] px-5 py-1 text-xs font-normal text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 active:bg-zinc-100 shadow-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
