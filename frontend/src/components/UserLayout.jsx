import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// Layout mỏng cho khu vực người dùng (không phải trang làm bài thi): chỉ gánh
// việc render Navbar 1 lần cho route cha, tránh 14 trang phải tự import/render
// <Navbar/> riêng lẻ (dễ trôi giao diện khi sửa). Không bọc thêm container/padding
// nào khác — mỗi trang con vẫn tự giữ nguyên wrapper/diện mạo hiện tại của nó.
// Mirror đúng pattern AdminLayout.jsx đã dùng cho khu vực admin.
export default function UserLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}
