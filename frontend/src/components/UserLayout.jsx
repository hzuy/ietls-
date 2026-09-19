import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import UserPageSkeleton from './skeletons/UserPageSkeleton'

// Layout mỏng cho khu vực người dùng (không phải trang làm bài thi): chỉ gánh
// việc render Navbar 1 lần cho route cha, tránh 14 trang phải tự import/render
// <Navbar/> riêng lẻ. Suspense fallback cục bộ giữ Navbar đứng yên tuyệt đối,
// loại bỏ 100% hiện tượng chớp tắt thanh điều hướng khi lazy load các trang con.
export default function UserLayout() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<UserPageSkeleton />}>
        <Outlet />
      </Suspense>
    </>
  )
}

