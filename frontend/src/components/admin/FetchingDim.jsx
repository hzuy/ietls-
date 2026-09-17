/**
 * Bọc vùng dữ liệu (bảng/lưới/danh sách) để làm mờ nhẹ khi có refetch nền
 * (đổi filter, phân trang, tìm kiếm, sắp xếp, đổi tab) — dữ liệu cũ vẫn hiển thị
 * nguyên vị trí thay vì unmount về skeleton/trắng rồi vẽ lại, tránh nhảy bố cục.
 * `isFetching` truyền thẳng từ useQuery (không dùng isLoading — cái đó chỉ nên
 * gate skeleton cho lần tải đầu tiên khi chưa có data). Xem AGENTS.md Việc 3.
 */
export default function FetchingDim({ isFetching, children }) {
  return (
    <div
      className={`transition-opacity duration-200 motion-reduce:transition-none ${
        isFetching ? 'opacity-50 pointer-events-none' : 'opacity-100'
      }`}
    >
      {children}
    </div>
  )
}
