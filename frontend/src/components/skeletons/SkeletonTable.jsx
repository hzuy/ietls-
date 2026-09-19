import AdminTableSkeleton from './AdminTableSkeleton'

/**
 * SkeletonTable — backward-compatible wrapper delegating to AdminTableSkeleton.
 * Default firstColType là 'avatar' để giữ đúng giao diện bảng tài khoản/người dùng.
 */
export default function SkeletonTable({
  rows = 8,
  cols = 5,
  firstColType = 'avatar',
  className = '',
}) {
  return (
    <AdminTableSkeleton
      rows={rows}
      cols={cols}
      firstColType={firstColType}
      className={className}
    />
  )
}
