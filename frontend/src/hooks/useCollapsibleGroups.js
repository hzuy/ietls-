import { useState, useCallback } from 'react'

/**
 * Quản lý trạng thái thu gọn/bung cho danh sách "nhóm câu hỏi" ở form soạn
 * Reading/Listening Practice. Theo id nhóm (`group._id`) → thêm/xoá/di chuyển
 * nhóm không ảnh hưởng (Set không phụ thuộc thứ tự).
 *
 * Mặc định: rỗng = tất cả thu gọn. Trang chủ động:
 *  - openEdit / openAdd / khôi phục nháp  → setAll([])   (thu gọn hết)
 *  - handleAddGroup (nhóm mới)            → reveal(newId) (chỉ bung nhóm vừa thêm)
 *  - nút "Mở tất cả"                      → setAll(mọi id)
 */
export function useCollapsibleGroups() {
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const isExpanded = useCallback((id) => expandedIds.has(id), [expandedIds])

  const toggle = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const reveal = useCallback((id) => {
    setExpandedIds(prev => new Set(prev).add(id))
  }, [])

  const setAll = useCallback((ids) => {
    setExpandedIds(new Set(ids))
  }, [])

  return { isExpanded, toggle, reveal, setAll }
}
