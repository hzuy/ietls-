import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../styles/ielts40.css'

import HeroSection from '../components/ielts40/HeroSection'
import BenefitsSection from '../components/ielts40/BenefitsSection'
import CurriculumSection from '../components/ielts40/CurriculumSection'
import TeachersSection from '../components/ielts40/TeachersSection'
import CourseScheduleTable from '../components/CourseScheduleTable'
import SidebarOffer from '../components/ielts40/SidebarOffer'

const schedulesData60 = [
  { id: 1, date: "29/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Bình Thạnh D3", locationFull: "24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM", filterValue: "Bình Thạnh D3" },
  { id: 2, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 3, date: "06/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 4, date: "06/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Gò Vấp", locationFull: "95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM", filterValue: "Gò Vấp" },
  { id: 5, date: "29/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 6, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Thủ Đức - Quận 9", locationFull: "Tầng 4 - 25B Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Quận 9" },
  { id: 7, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 8, date: "31/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 9, date: "10/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Gò Vấp", locationFull: "95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM", filterValue: "Gò Vấp" },
  { id: 10, date: "15/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Đà Nẵng", locationFull: "Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q. Hải Châu, Đà Nẵng", filterValue: "Đà Nẵng" },
  { id: 11, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Thủ Đức - Võ Văn Ngân", locationFull: "126 Võ Văn Ngân, phường Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Võ Văn Ngân" },
  { id: 12, date: "07/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 13, date: "06/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Bình Thạnh D3", locationFull: "24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM", filterValue: "Bình Thạnh D3" },
  { id: 14, date: "06/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 15, date: "09/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 16, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Hà Nội - Thanh Xuân", locationFull: "Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội", filterValue: "Hà Nội - Thanh Xuân" },
  { id: 17, date: "28/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 18, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 7/CN", time: "14:00 - 17:00", locationShort: "Hà Nội - Thanh Xuân", locationFull: "Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội", filterValue: "Hà Nội - Thanh Xuân" },
  { id: 19, date: "25/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 20, date: "10/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "18:00 - 20:00", locationShort: "Hà Nội - Đống Đa", locationFull: "Tầng G, số 158 Phố Chùa Láng, Q.Đống Đa, Hà Nội", filterValue: "Hà Nội - Đống Đa" },
  { id: 21, date: "09/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "09:00 - 12:00", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 22, date: "12/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 23, date: "15/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 24, date: "30/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 25, date: "11/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Hà Nội - Thanh Xuân", locationFull: "Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội", filterValue: "Hà Nội - Thanh Xuân" },
  { id: 26, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Đà Nẵng", locationFull: "Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q. Hải Châu, Đà Nẵng", filterValue: "Đà Nẵng" },
  { id: 27, date: "28/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Bình Thạnh NVĐ", locationFull: "183c Nguyễn Văn Đậu, P.11, Bình Thạnh, TP.HCM", filterValue: "Bình Thạnh NVĐ" },
  { id: 28, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Gò Vấp", locationFull: "95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM", filterValue: "Gò Vấp" },
  { id: 29, date: "25/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Thủ Đức - Võ Văn Ngân", locationFull: "126 Võ Văn Ngân, phường Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Võ Văn Ngân" },
  { id: 30, date: "30/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Thủ Đức - Võ Văn Ngân", locationFull: "126 Võ Văn Ngân, phường Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Võ Văn Ngân" },
  { id: 31, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 32, date: "15/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 33, date: "26/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 34, date: "01/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 35, date: "10/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "18:00 - 20:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 36, date: "05/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 37, date: "13/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Tân Bình", locationFull: "24A Bàu Cát 2, Tân Bình, P.14, TP.HCM", filterValue: "Tân Bình" },
  { id: 38, date: "11/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "18:00 - 20:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 39, date: "04/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 40, date: "15/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 41, date: "02/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Bình Thạnh D3", locationFull: "24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM", filterValue: "Bình Thạnh D3" },
  { id: 42, date: "05/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 43, date: "29/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 44, date: "13/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Quận 12", locationFull: "1038-1040 Nguyễn Ảnh Thủ, P. Tân Chánh Hiệp, Q.12, TP.HCM", filterValue: "Quận 12" },
  { id: 45, date: "10/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 46, date: "03/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Thủ Đức - Võ Văn Ngân", locationFull: "126 Võ Văn Ngân, phường Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Võ Văn Ngân" },
  { id: 47, date: "05/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Quận 12", locationFull: "1038-1040 Nguyễn Ảnh Thủ, P. Tân Chánh Hiệp, Q.12, TP.HCM", filterValue: "Quận 12" },
  { id: 48, date: "02/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 49, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 50, date: "27/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 51, date: "07/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 2/4/6", time: "19:30 - 21:30", locationShort: "Quận 10", locationFull: "Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM", filterValue: "Quận 10" },
  { id: 52, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Gò Vấp", locationFull: "95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM", filterValue: "Gò Vấp" },
  { id: 53, date: "06/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Bình Thạnh D3", locationFull: "24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM", filterValue: "Bình Thạnh D3" },
  { id: 54, date: "09/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 7/CN", time: "09:00 - 12:00", locationShort: "Quận 7", locationFull: "456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM", filterValue: "Quận 7" },
  { id: 55, date: "26/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "13:30 - 16:30", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 56, date: "04/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Hà Nội - Thanh Xuân", locationFull: "Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội", filterValue: "Hà Nội - Thanh Xuân" },
  { id: 57, date: "29/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "17:30 - 19:30", locationShort: "Bình Thạnh NVĐ", locationFull: "183c Nguyễn Văn Đậu, P.11, Bình Thạnh, TP.HCM", filterValue: "Bình Thạnh NVĐ" },
  { id: 58, date: "25/07/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Hà Nội - Đống Đa", locationFull: "Tầng G, số 158 Phố Chùa Láng, Q.Đống Đa, Hà Nội", filterValue: "Hà Nội - Đống Đa" },
  { id: 59, date: "28/07/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Thủ Đức - Quận 9", locationFull: "Tầng 4 - 25B Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP.HCM", filterValue: "Thủ Đức - Quận 9" },
  { id: 60, date: "26/07/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 7/CN", time: "09:00 - 12:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 61, date: "09/08/2026", course: "Khóa IELTS 6.0", status: "GẦN HẾT CHỖ", days: "Thứ 7/CN", time: "09:00 - 12:00", locationShort: "Quận 6", locationFull: "61-63 Bà Hom, P.13, Q.6, TP.HCM", filterValue: "Quận 6" },
  { id: 62, date: "10/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "18:00 - 20:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 63, date: "13/08/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "19:30 - 21:30", locationShort: "Gò Vấp", locationFull: "95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM", filterValue: "Gò Vấp" },
  { id: 64, date: "08/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 3/5/7", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 65, date: "05/08/2026", course: "Khóa IELTS 6.0", status: "HẾT CHỖ", days: "Thứ 2/4/6", time: "20:00 - 22:00", locationShort: "Online", locationFull: "", filterValue: "Online" },
  { id: 66, date: "08/09/2026", course: "Khóa IELTS 6.0", status: "CÒN CHỖ", days: "Thứ 3/5/7", time: "17:30 - 19:30", locationShort: "Tân Phú - Tân Thắng", locationFull: "123 Tân Thắng, Tân Sơn Nhì, TP.HCM", filterValue: "Tân Phú - Tân Thắng" },
]

const ielts60Outcomes = [
  'Áp dụng tư duy học bản chất, bỏ thói quen đọc dịch, viết dịch, nói dịch',
  'Có kiến thức về cấu trúc và cách tiếp cận bài thi IELTS hiệu quả',
  'Vận dụng vốn từ vựng và ngữ pháp để viết, nói 1 bài lưu loát, tự nhiên & logic',
  'Hiểu nhanh, chính xác nội dung 1 bài đọc thuộc các chủ đề khó, lạ, thiếu từ vựng',
  'Lắp đầy những lỗ hổng còn trống về từ vựng và ngữ pháp',
]

const ielts60Sessions = [
  {
    id: 1,
    title: 'Buổi 1 — Reading 1: Thay đổi tư duy đọc tiếng Anh',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Vấn đề trong cách đọc hiện tại của học viên: đọc dịch/ skimming và scanning', duration: '30 mins' },
      { num: 2, title: 'Áp dụng Linearthinking vào Reading để giải quyết những vấn đề trên', duration: '45 mins' },
      { num: 3, title: 'Áp dụng vào bài đọc thực tế', duration: '40 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Luyện tập áp dụng phương pháp tập đọc trước bài đọc (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2 — Writing 1: Thay đổi tư duy viết tiếng Anh',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Vấn đề với cách học tiếng Anh cũ: học từ vựng và ngữ pháp sai sách', duration: '15 mins' },
      { num: 2, title: 'Cách học vocab đúng', duration: '35 mins' },
      { num: 3, title: 'Cách học cấu trúc câu đúng', duration: '20 mins' },
      { num: 4, title: 'Cách viết câu đúng', duration: '15 mins' },
      { num: 5, title: 'Luyện tập: Các bước để viết một câu đơn đúng', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập cách tra từ, cấu trúc câu, và cách viết câu đúng (10 mins)', duration: '10 mins' },
      { num: 8, title: 'Làm bài tập viết câu Build a sentence (60 mins)', duration: '60 mins' },
    ],
  },
  {
    id: 3,
    title: 'Buổi 3 — Speaking 1: Cách dùng Statements để bắt đầu một câu trả lời',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề học viên thường gặp khi nói tiếng Anh + các vấn đề khi trả lời 1 câu hỏi IELTS', duration: '30 mins' },
      { num: 2, title: 'Cách dùng statements để bắt đầu một câu trả lời', duration: '20 mins' },
      { num: 3, title: 'Practice', duration: '40 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Listening 1: Cách làm Section 1', duration: '30 mins' },
      { num: 6, title: 'Practice nhuyễn lại Statement cho các câu hỏi topic Work & Study + Accommodation + Flowers để prepare cho bài 2 (20-30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4 — Reading 2: Cách đọc cấu trúc câu',
    duration: '230 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: các bước đọc theo cấu trúc để đơn giản hóa 1 câu theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Những cấu trúc câu đơn và phức thường gặp trong bài đọc', duration: '60 mins' },
      { num: 3, title: 'Áp dụng phân tích cấu trúc câu của 1 bài đọc cụ thể (Cigarette Smoking)', duration: '50 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Ôn tập các dạng cấu trúc câu đã học (15 mins)', duration: '15 mins' },
      { num: 6, title: 'Đọc theo cấu trúc hết bài đọc trên lớp (20 mins)', duration: '20 mins' },
      { num: 7, title: 'Làm Reflection để tổng hợp và học từ vựng và cấu trúc (30 mins)', duration: '30 mins' },
      { num: 8, title: 'Đọc trước bài Raising Mary Rose và Stepwells để trả lời các câu hỏi Gap fill (30-45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5 — Writing 2: Cách cải thiện 1 câu và connect 2 câu',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách viết 1 câu đúng theo Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Cách self-correct một câu', duration: '15 mins' },
      { num: 3, title: 'Cách cải thiện một câu', duration: '20 mins' },
      { num: 4, title: 'Cách kết nối 2 câu: with and without linking words', duration: '30 mins' },
      { num: 5, title: 'Giới thiệu dạng bài tập Collocation và áp dụng luyện tập kết nối 2 câu', duration: '45 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập các cách kết nối và cải thiện câu (15 mins)', duration: '15 mins' },
      { num: 8, title: 'Làm và học bài Collocations (45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6 — Speaking 2: Cách trả lời câu hỏi Part 1 (Dùng Linearthinking)',
    duration: '175 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách mở đầu câu trả lời', duration: '5 mins' },
      { num: 2, title: 'Cách trả lời câu hỏi Part 1 dùng Linearthinking', duration: '30 mins' },
      { num: 3, title: 'Practice: Topic Work and Study', duration: '30 mins' },
      { num: 4, title: 'Practice: Topic Accommodation', duration: '15 mins' },
      { num: 5, title: 'Practice: Flowers and Internet', duration: '15 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 2: Cách làm bài dạng Map', duration: '30 mins' },
      { num: 8, title: 'Practice trả lời full Part 1 (đảm bảo câu Statement + expand) cho 3 topic Noises + Transportation + Photography để prepare cho bài 3 (30-45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7 — Reading 3: Cách trả lời câu hỏi Gapfill',
    duration: '225 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đọc cấu trúc câu', duration: '5 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng Gapfill', duration: '20 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng Gapfill', duration: '20 mins' },
      { num: 4, title: 'Cách xác định dạng từ điền vào gap', duration: '15 mins' },
      { num: 5, title: 'Cách nhận diện paraphrasing', duration: '15 mins' },
      { num: 6, title: 'Áp dụng vào bài đọc cụ thể', duration: '60 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Ôn tập các bước làm dạng Gap fill (10 mins)', duration: '10 mins' },
      { num: 9, title: 'Áp dụng kỹ năng đã học vào làm bài gap fill Snowmaker (30 mins)', duration: '30 mins' },
      { num: 10, title: 'Đọc trước và làm bài TFNG của Raising Mary Rose và Step wells (30-45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8 — Writing 3: Cách áp dụng Linearthinking vào Writing Task 2',
    duration: '220 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách cải thiện 1 câu và connect 2 câu', duration: '5 mins' },
      { num: 2, title: 'Sơ lược về Writing Task 2', duration: '15 mins' },
      { num: 3, title: 'Xác định những vấn đề thường gặp trong Writing Task 2', duration: '30 mins' },
      { num: 4, title: 'Giải pháp của IELTSPro: 4 bước viết 1 bài Writing Task 2', duration: '45 mins' },
      { num: 5, title: 'Áp dụng vào đề bài cụ thể (dạng Advantages và Disadvantages)', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập lại nội dung đã học (10 mins)', duration: '10 mins' },
      { num: 8, title: 'Làm bài tập Collocation và học bài (45 mins)', duration: '45 mins' },
      { num: 9, title: 'Làm bài trên hệ thống LMS (45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 9,
    title: 'Buổi 9 — Speaking 3: Cách dùng connectives để liên kết các câu',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Task 1', duration: '5 mins' },
      { num: 2, title: 'Cách để kết nối ideas', duration: '10 mins' },
      { num: 3, title: 'Connectives: Reason', duration: '20 mins' },
      { num: 4, title: 'Connectives: Description', duration: '20 mins' },
      { num: 5, title: 'Connectives: Feelings', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 3: Cách làm bài dạng Floor plan', duration: '30 mins' },
      { num: 8, title: 'Practice trả lời lại tất cả 6 topic từ buổi 1, đảm bảo đủ tất cả các yếu tố đã học qua 3 buổi: Statement + Expand + Coherence) (45 mins - 1 hour)', duration: '60 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10 — Reading 4: Cách trả lời câu hỏi True/ False/ Not Given',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Gapfill và sửa bài về nhà', duration: '20 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng True/ False/ Not Given', duration: '10 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng True/ False/ Not Given', duration: '60 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc cụ thể', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Ôn tập các bước làm bài True/False/Not given (10 mins)', duration: '10 mins' },
      { num: 7, title: 'Luyện tập thêm các dạng bài True/False/ Not given và Gap fill trên hệ thống Online test và Vocab Builder', duration: '30 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11 — Writing 4: Cách tiếp cận dạng Problems Causes Solutions',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking vào Writing', duration: '5 mins' },
      { num: 2, title: 'Outline dạng Problems Causes Solutions', duration: '30 mins' },
      { num: 3, title: 'Luyện tập Linearthinking trong Writing và cách đưa Problems và Causes', duration: '45 mins' },
      { num: 4, title: 'Cách nghĩ ra Solutions thuyết phục', duration: '35 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Ôn tập cách làm bài Problems-Causes-Solutions (10 mins)', duration: '10 mins' },
      { num: 7, title: 'Làm bài tập trên LMS (60 mins)', duration: '60 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12 — Speaking 4: Introduce Part 3 + Cách paraphrase trong Speaking',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp lại kiến thức về Part 1', duration: '10 mins' },
      { num: 2, title: 'Introduce Part 3 + Các vấn đề cơ bản trong việc trả lời câu hỏi Part 3 (gặp nhiều idea khó diễn đạt + expand)', duration: '30 mins' },
      { num: 3, title: 'Cách paraphrase trong Speaking', duration: '15 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 4: Cách làm bài dạng Sentence Completion (Flowchart)', duration: '30 mins' },
      { num: 7, title: 'Dùng các idea đã paraphrase được để trả lời cho các câu hỏi topic Travel + Education + Advertisement (40 mins)', duration: '40 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13 — Reading 5: Cách học từ vựng hiệu quả',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Gapfill', duration: '5 mins' },
      { num: 2, title: 'Cách học vocab (collocations) theo 3 levels', duration: '60 mins' },
      { num: 3, title: 'Practice', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Áp dụng cách học từ vựng vào việc học collocations các chủ đề còn lại ở trong sách (60 mins)', duration: '60 mins' },
      { num: 6, title: 'Đọc và làm phần Matching Headings của bài Snowmaker và bài Organic Food (60 mins)', duration: '60 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14 — Writing 5: Cách trả lời dạng câu hỏi Agree/ Disagree',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời dạng Discuss both views', duration: '5 mins' },
      { num: 2, title: 'Cách tiếp cận cho dạng bài Agree/ Disagree', duration: '45 mins' },
      { num: 3, title: 'Outline cho dạng bài Agree/ Disagree', duration: '20 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '45 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Ôn tập phương pháp tiếp cận dạng bài Agree/ Disagree (10 mins)', duration: '10 mins' },
      { num: 7, title: 'Làm bài trên hệ thống LMS (60 mins)', duration: '60 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15 — Speaking 5: Linear framework trong Part 3',
    duration: '145 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách paraphrase trong Speaking', duration: '5 mins' },
      { num: 2, title: 'Vấn đề khi phát triển ideas cho part 3', duration: '15 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để phát triển ideas cho part 3', duration: '20 mins' },
      { num: 4, title: 'Practice topic Education', duration: '20 mins' },
      { num: 5, title: 'Practice topic Traveling', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 5: Cách làm bài dạng Sentence Completion', duration: '30 mins' },
      { num: 8, title: 'Practice các câu hỏi Part 3 topic Education + Traveling (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16 — Reading 6: Cách đọc connection và cách làm dạng bài Matching Heading',
    duration: '220 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách học từ vựng hiệu quả', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng Matching Heading', duration: '15 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Matching Heading', duration: '20 mins' },
      { num: 4, title: 'Cách đọc connection giữa 2 câu', duration: '30 mins' },
      { num: 5, title: 'Áp dụng vào bài đọc', duration: '45 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập các bước đọc connection (10 mins)', duration: '10 mins' },
      { num: 8, title: 'Đọc và làm bài Multiple Choice và Matching names bài “The meaning of Volunteering”, bài “Persistent bullying is one of the worst experiences a child can face.”, bài “Second Nature”', duration: '90 mins' },
    ],
  },
  {
    id: 17,
    title: 'Buổi 17 — Writing 6: Các cách paraphrase và đưa ví dụ',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập các nội dung Writing đã học', duration: '15 mins' },
      { num: 2, title: 'Các cách để paraphrase', duration: '90 mins' },
      { num: 3, title: 'Cách đưa Example cho hay và logic', duration: '20 mins' },
      { num: 4, title: 'Tổng hợp những lỗi hay mắc phải trong Writing Task 2 và cách ôn luyện writing task 2', duration: '5 mins' },
      { num: 5, title: 'Ôn tập các nội dung đã học (10 mins)', duration: '10 mins' },
      { num: 6, title: 'Làm và học bài Collocation (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 18,
    title: 'Buổi 18 — Speaking 6: Luyện tập trả lời câu hỏi Part 3',
    duration: '130 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking để phát triển ideas trong part 3', duration: '15 mins' },
      { num: 2, title: 'Áp dụng vào đề thi Part 3 thật', duration: '90 mins' },
      { num: 3, title: 'Tổng hợp những lỗi thường gặp khi trả lời câu hỏi Part 3 + cách học vocab hiệu quả cho Part 3', duration: '20 mins' },
      { num: 4, title: 'Giao homework', duration: '5 mins' },
    ],
  },
  {
    id: 19,
    title: 'Buổi 19 — Reading 7: Cách làm dạng bài Multiple Choice và Matching names',
    duration: '175 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Matching Heading', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng Multiple Choice', duration: '15 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Multiple Choice', duration: '15 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc', duration: '45 mins' },
      { num: 5, title: 'Cách IELTSPro tiếp cận dạng Matching names', duration: '35 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập cách tiếp cận dạng bài Multiple choice và Matching names (10 mins)', duration: '10 mins' },
      { num: 8, title: 'Làm full bài “Gifted Children” và phần matching information của bài Second Nature (45 mins)', duration: '45 mins' },
    ],
  },
  {
    id: 20,
    title: 'Buổi 20 — Writing 7: Linearthinking trong Writing Task 1',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Các dạng bài trong Task 2', duration: '5 mins' },
      { num: 2, title: 'Giới thiệu Task 1', duration: '10 mins' },
      { num: 3, title: 'Cách viết introduction cho Task 1', duration: '30 mins' },
      { num: 4, title: 'Cách chọn thông tin cho Overview và Body theo Linearthinking', duration: '45 mins' },
      { num: 5, title: 'Luyện tập', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Ôn tập lại kiến thức đã học (10 mins)', duration: '10 mins' },
      { num: 8, title: 'Áp dụng viết outline các charts trong sách (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 21,
    title: 'Buổi 21 — Speaking 7: Cách trả lời 3 câu hỏi nhỏ trong Part 2',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức Part 3', duration: '5 mins' },
      { num: 2, title: 'Introduce Part 2 + các vấn đề gặp phải trong Part 2', duration: '20 mins' },
      { num: 3, title: 'Cách trả lời 3 câu hỏi gợi ý nhỏ trong Part 2', duration: '20 mins' },
      { num: 4, title: 'Practice dạng đề People', duration: '20 mins' },
      { num: 5, title: 'Practice dạng đề Object', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 7: Cách làm bài dạng Sentence Completion (Table)', duration: '30 mins' },
      { num: 8, title: 'Tập trả lời lại hết các phần câu hỏi gợi ý của 6 đề Part 2', duration: '90 mins' },
    ],
  },
  {
    id: 22,
    title: 'Buổi 22 — Reading 8: Cách làm dạng Matching Endings và Matching Information',
    duration: '175 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Matching names và Multiple Choice', duration: '5 mins' },
      { num: 2, title: 'Cách IELTSPro tiếp cận dạng Matching Endings và áp dụng vào bài đọc', duration: '45 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Matching information và áp dụng vào bài đọc', duration: '45 mins' },
      { num: 4, title: 'Chiến lược làm bài Reading khi đi thi và cách ôn tập', duration: '30 mins' },
      { num: 5, title: 'Ôn tập toàn bộ chương trình Reading (10 mins)', duration: '10 mins' },
      { num: 6, title: 'Luyện tập thêm 2 bài trên hệ thống Online Test và Vocab Builder (40 mins)', duration: '40 mins' },
    ],
  },
  {
    id: 23,
    title: 'Buổi 23 — Writing 8: Cách miêu tả số liệu trong Writing Task 1 và cấu trúc so sánh trong Writing Task 1',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Linearthinking trong Task 1', duration: '5 mins' },
      { num: 2, title: 'Cách miêu tả số liệu trong Task 1', duration: '40 mins' },
      { num: 3, title: 'Cấu trúc câu so sánh trong Writing Task 1', duration: '45 mins' },
      { num: 4, title: 'Áp dụng vào bài Task 1', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Ôn tập cách nêu số liệu và so sánh trong bài Writing task 1 (10 mins)', duration: '10 mins' },
      { num: 7, title: 'Áp dụng vào làm bài trên LMS (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 24,
    title: 'Buổi 24 — Speaking 8: Cách trả lời câu hỏi Why trong Part 2',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời 3 câu hỏi nhỏ trong Part 2', duration: '5 mins' },
      { num: 2, title: 'Cách trả lời câu hỏi Why trong Part 2', duration: '20 mins' },
      { num: 3, title: 'Practice dạng đề People', duration: '20 mins' },
      { num: 4, title: 'Practice dạng đề Object', duration: '20 mins' },
      { num: 5, title: 'Practice nói full 1 bài part 2', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 8: Cách làm bài dạng Sentence Completion (Section 4)', duration: '30 mins' },
      { num: 8, title: 'Chuẩn bị 4 đề Part 2 (2 đề People + 2 đề Object)', duration: '90 mins' },
    ],
  },
  {
    id: 25,
    title: 'Buổi 25 — Writing 9: Ngôn ngữ tăng giảm + Cách viết bài Task 1 hoàn chỉnh',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách so sánh trong Task 1', duration: '5 mins' },
      { num: 2, title: 'Cách sử dụng Language of trend (ngôn ngữ tăng giảm) trong Task 1', duration: '60 mins' },
      { num: 3, title: 'Viết 1 bài Task 1 hoàn chỉnh', duration: '50 mins' },
      { num: 4, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 5, title: 'Ôn tập toàn bộ Task 1 (10 mins)', duration: '10 mins' },
      { num: 6, title: 'Áp dụng làm bài tập trên LMS (30 mins)', duration: '30 mins' },
    ],
  },
  {
    id: 26,
    title: 'Buổi 26 — Speaking 9: Revision toàn khóa + Extra Practice Part 2',
    duration: '125 mins',
    lessons: [
      { num: 1, title: 'Revision các điểm quan trọng của cả 3 parts.', duration: '20 mins' },
      { num: 2, title: 'Practice Part 2 các đề topic People + Object', duration: '90 mins' },
      { num: 3, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 4, title: 'Listening 9: ôn tập', duration: '10 mins' },
    ],
  },
  {
    id: 27,
    title: 'Buổi 27 — Sửa bài Final Test',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Những điểm cần lưu ý và bài học rút ra từ Final Test', duration: '90 mins' },
      { num: 2, title: 'Nhìn lại chặng đường tiến bộ sau khóa học', duration: '30 mins' },
    ],
  },
]

const ielts60Teachers = {
  1: {
    name: 'Cô Từ Kim Loan',
    titleName: 'Cô Từ Kim Loan',
    titlePrefix: 'Cô',
    quoteLabel: 'CÔ',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IELTSPro)',
      '8.5 IELTS Overall',
      '8.5 IELTS Writing',
      '8.5 IELTS Speaking',
      'Cử nhân Đại học Ngân hàng',
      'Cựu học sinh PTNK TPHCM',
    ],
    quote: 'Đi dạy không chỉ mang lại kiến thức cho học viên mà còn gây được cho học viên sự ham muốn học để mỗi ngày đến trường, học viên có 1 niềm hứng khởi và muốn tiếp tục con đường học hành.',
  },
  2: {
    name: 'Cô Huỳnh Long Thiên Tâm',
    titleName: 'Cô Huỳnh Long Thiên Tâm',
    titlePrefix: 'Cô',
    quoteLabel: 'CÔ',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IELTSPro)',
      '8.0 IELTS Overall',
      'Cử nhân Ngôn Ngữ Anh - ĐH KHXH&NV',
    ],
    quote: 'Điều mà mình thực sự hướng đến là những giá trị giáo dục lâu dài thực sự hữu ích để học viên có thể sử dụng trong các mục đích sau này của cuộc sống.',
  },
}

export default function Ielts60() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa IELTS 6.0 | IELTSPro'
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Navbar />
      <div className="course-detail-wrapper">
        <div className="cd-container">
          {/* Breadcrumb */}
          <nav className="cd-breadcrumb">
            <a onClick={() => navigate('/')}>Trang chủ</a>
            <span className="separator">›</span>
            <a onClick={() => navigate('/courses')}>Khóa học IELTS</a>
            <span className="separator">›</span>
            <span className="current">IELTS 6.0</span>
          </nav>

          {/* 2-Column Grid Layout */}
          <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (lg:col-span-2) */}
            <main className="cd-main lg:col-span-2">
              <HeroSection
                title="Khóa IELTS 6.0"
                rating="5.0/5"
                reviews="10,000 review"
                teachers={ielts60Teachers}
                description="Nếu những phương pháp học như Skim - Scan vẫn chưa giúp bạn bứt phá điểm số, đã đến lúc thay đổi cách học. Khoá IELTS 6.0 với phương pháp Linearthinking được xây dựng phù hợp với tư duy của người Việt, giúp bạn xử lý hiệu quả cả 4 kỹ năng, tiến bộ nhanh hơn và sẵn sàng chinh phục những mức điểm cao hơn."
                inputBand="IELTS 5.0"
                outputBand="IELTS 6.0"
              />
              <BenefitsSection outcomes={ielts60Outcomes} />
              <CurriculumSection
                title="Chương trình học 9 tuần"
                headerMeta="27 Buổi · 187 Bài học · 54h học tập"
                sessions={ielts60Sessions}
                unit="buổi"
              />
              <TeachersSection teachers={ielts60Teachers} />
              <CourseScheduleTable title="Lịch học Khóa IELTS 6.0" scheduleData={schedulesData60} />
            </main>

            {/* Right Column (lg:col-span-1) */}
            <SidebarOffer />
          </div>
        </div>
      </div>
    </>
  )
}
