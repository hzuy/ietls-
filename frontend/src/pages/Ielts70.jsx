import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import '../styles/ielts40.css'

import { schedulesData } from '../data/ielts40Data'

import HeroSection from '../components/ielts40/HeroSection'
import BenefitsSection from '../components/ielts40/BenefitsSection'
import CurriculumSection from '../components/ielts40/CurriculumSection'
import TeachersSection from '../components/ielts40/TeachersSection'
import CourseScheduleTable from '../components/CourseScheduleTable'
import SidebarOffer from '../components/ielts40/SidebarOffer'

const schedulesData70 = [
  { id: 1, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 2, startDate: '04/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 3, startDate: '06/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 4, startDate: '14/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 5, startDate: '21/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP.HCM' },
  { id: 6, startDate: '07/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, P.11, Bình Thạnh, TP.HCM' },
  { id: 7, startDate: '14/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 8, startDate: '20/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Hà Nội - Thanh Xuân', address: 'Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 9, startDate: '26/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Đà Nẵng', address: 'Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q. Hải Châu, Đà Nẵng' },
  { id: 10, startDate: '13/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '18:00 - 20:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 11, startDate: '03/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 12, startDate: '03/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 13, startDate: '01/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 14, startDate: '10/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 15, startDate: '12/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 16, startDate: '16/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 17, startDate: '16/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 18, startDate: '17/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 19, startDate: '09/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 20, startDate: '29/07/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Hà Nội - Thanh Xuân', address: 'Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 21, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 22, startDate: '01/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 23, startDate: '05/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 24, startDate: '27/07/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 25, startDate: '15/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 26, startDate: '14/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 27, startDate: '04/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Thủ Đức - Võ Văn Ngân', address: '126 Võ Văn Ngân, phường Thủ Đức, TP.HCM' },
  { id: 28, startDate: '04/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 29, startDate: '26/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '18:00 - 20:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 30, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Hà Nội - Đống Đa', address: 'Tầng G, số 158 Phố Chùa Láng, Q.Đống Đa, Hà Nội' },
  { id: 31, startDate: '15/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Thủ Đức - Võ Văn Ngân', address: '126 Võ Văn Ngân, phường Thủ Đức, TP.HCM' },
  { id: 32, startDate: '01/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 33, startDate: '30/07/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 34, startDate: '21/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP.HCM' },
  { id: 35, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 36, startDate: '12/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Hà Nội - Đống Đa', address: 'Tầng G, số 158 Phố Chùa Láng, Q.Đống Đa, Hà Nội' },
  { id: 37, startDate: '03/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, P. Tân Chánh Hiệp, Q.12, TP.HCM' },
  { id: 38, startDate: '30/07/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 39, startDate: '01/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 40, startDate: '29/07/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 41, startDate: '04/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 42, startDate: '22/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, P. Tân Chánh Hiệp, Q.12, TP.HCM' },
  { id: 43, startDate: '18/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, P.11, Bình Thạnh, TP.HCM' },
  { id: 44, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 45, startDate: '08/08/2026', courseName: 'Khóa IELTS 7.0', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
]

const ielts70Outcomes = [
  'Hiểu rõ cấu trúc đề IELTS Writing, Speaking và có chiến lược làm bài hiệu quả',
  'Áp dụng tư duy học bản chất vào 2 kỹ năng Writing, Speaking',
  'Luyện tập tăng cường để làm chủ những dạng đề phức tạp nhất của IELTS',
  'Khắc phục hoàn toàn những lỗ hổng trong kiến thức và kỹ năng',
  'Có khả năng diễn đạt và phát triển ý tưởng một cách nhanh chóng, lưu loát',
  'Tích lũy từ vựng và ngữ pháp cao cấp và có thể áp dụng thuần thục khi nói, viết',
]

const ielts70Sessions = [
  {
    id: 1,
    title: 'Buổi 1 — Reading 1: Thay đổi tư duy đọc tiếng Anh',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề tồn đọng của cách đọc dịch/ skimming và scanning', duration: '30 mins' },
      { num: 2, title: 'Áp dụng Linearthinking vào Reading để giải quyết những vấn đề trên', duration: '60 mins' },
      { num: 3, title: 'Áp dụng vào bài đọc thực tế', duration: '30 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Làm bài đọc: What is meaning?', duration: '30 mins' },
      { num: 6, title: 'Measures to combat infectious diseases', duration: '40 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2 — Writing 1: Marking Criteria in Writing Task 2',
    duration: '185 mins',
    lessons: [
      { num: 1, title: 'Giới thiệu sơ lược 4 tiêu chí trong IELTS Writing', duration: '30 mins' },
      { num: 2, title: 'Cách đạt điểm cao trong Lexical Resource', duration: '60 mins' },
      { num: 3, title: 'Cách đạt điểm cao trong Grammar', duration: '30 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Bài tập viết câu đúng', duration: '60 mins' },
    ],
  },
  {
    id: 3,
    title: 'Buổi 3 — Speaking 1: Thay đổi tư duy nói tiếng Anh: Cách nói tiếng Anh luôn đúng & Các vấn đề chính khi trả lời câu hỏi IELTS Part 1',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề học viên thường gặp khi nói tiếng Anh + Các vấn đề khi trả lời câu hỏi IELTS Part 1', duration: '20 mins' },
      { num: 2, title: 'Cách nói một câu đúng', duration: '20 mins' },
      { num: 3, title: 'Practice', duration: '20 mins' },
      { num: 4, title: 'Cách sử dụng các Connectives và cấu trúc câu khác nhau nhằm tăng tính Coherence và Flexible khi nói', duration: '20 mins' },
      { num: 5, title: 'Practice: Áp dụng vào các câu hỏi IELTS Part 1', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 1: Cách làm Section 1', duration: '15 mins' },
      { num: 8, title: 'Practice nói một câu đúng & nhuần nhuyễn cấu trúc', duration: '45 mins' },
      { num: 9, title: 'Đọc trước các sample answer để rút ra cách tiếp cận các câu hỏi khó', duration: '15 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4 — Reading 2: Cách đọc cấu trúc câu và đọc connection giữa 2 câu',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Đọc cấu trúc theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Cách đọc cấu trúc một câu + luyện tập', duration: '60 mins' },
      { num: 3, title: 'Cách đọc connection giữa hai câu + luyện tập', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Why companies should welcome disorder', duration: '40 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5 — Writing 2: Thay đổi tư duy viết tiếng Anh',
    duration: '215 mins',
    lessons: [
      { num: 1, title: 'Vấn đề với cách học tiếng Anh cũ: học từ vựng và ngữ pháp sai sách', duration: '30 mins' },
      { num: 2, title: 'Cách viết câu đúng cấu trúc', duration: '30 mins' },
      { num: 3, title: 'Cách học vocab đúng', duration: '30 mins' },
      { num: 4, title: 'Cách học cấu trúc câu đúng', duration: '30 mins' },
      { num: 5, title: 'Luyện tập: Các bước để viết một câu đơn đúng', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Bài tập viết câu đúng', duration: '60 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6 — Speaking 2: Cách phát triển câu trả lời sử dụng Linear framework + Cách tiếp cận các câu hỏi khó',
    duration: '220 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách nói 1 câu tiếng Anh luôn đúng', duration: '5 mins' },
      { num: 2, title: 'Khai thác các vấn đề với cách phát triển câu trả lời', duration: '20 mins' },
      { num: 3, title: 'Cách tiếp cận với câu hỏi khó', duration: '20 mins' },
      { num: 4, title: 'Practice áp dụng vào các câu hỏi IELTS Part 1 khó', duration: '10 mins' },
      { num: 5, title: 'Cách dùng các công cụ Linearframework để phát triển câu trả lời', duration: '20 mins' },
      { num: 6, title: 'Practice', duration: '20 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Listening: Cách làm dạng Form Completion (Section 1)', duration: '30 mins' },
      { num: 9, title: 'Practice nói lại nhuần nhuyễn các topic trên lớp', duration: '45 mins' },
      { num: 10, title: 'Đọc sample answers để rút ra từ vựng + cách mở đầu câu trả lời hay', duration: '45 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7 — Reading 3: Cách trả lời câu hỏi Matching Heading',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đọc cấu trúc câu và connection giữa 2 câu', duration: '5 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng Matching Heading', duration: '30 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng Matching Heading', duration: '30 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc cụ thể', duration: '60 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Làm bài đọc: Bring back the big cats', duration: '40 mins' },
      { num: 7, title: 'Young Children’s Sense of Identity', duration: '40 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8 — Writing 3: Advantage-Disadvantage + 2-part questions',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập Discuss Both Views', duration: '5 mins' },
      { num: 2, title: 'Approach chung trả lời dạng Advantage-Disadvantage + 2-part questions', duration: '60 mins' },
      { num: 3, title: 'Áp dụng Linearthinking cụ thể hoá câu 123813 cho 2 dạng trên', duration: '60 mins' },
      { num: 4, title: 'Practice', duration: '5 mins' },
      { num: 5, title: 'Bài tập viết outline 123813 dạng Advantage-Disadvantage + 2-part questions', duration: '60 mins' },
    ],
  },
  {
    id: 9,
    title: 'Buổi 9 — Speaking 3: Cách mở đầu câu trả lời',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách phát triển câu trả lời dùng Linear Framework + Cách tiếp cận câu hỏi khó', duration: '5 mins' },
      { num: 2, title: 'Cách mở đầu câu trả lời hay và tăng phản xạ trả lời câu hỏi', duration: '30 mins' },
      { num: 3, title: 'Tổng hợp lại các từ vựng và cấu trúc hay để mở đầu câu trả lời', duration: '10 mins' },
      { num: 4, title: 'Practice', duration: '20 mins' },
      { num: 5, title: 'Tổng hợp kiến thức quan trọng của IELTS Part 1', duration: '10 mins' },
      { num: 6, title: 'Practice áp dụng vào đề thi IELTS Part 1', duration: '20 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Listening: Cách làm dạng Map/ Floor plan', duration: '30 mins' },
      { num: 9, title: 'Practice lại tất cả các topic Part 1 trên lớp', duration: '60 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10 — Reading 4: Cách trả lời câu hỏi Matching names và Multiple Choice',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Matching Heading', duration: '5 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng Multiple Choice', duration: '30 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng Multiple Choice', duration: '60 mins' },
      { num: 4, title: 'Cách áp dụng Linearthinking vào dạng Matching name', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Làm bài đọc: Bring Cinnamon Back to Europe', duration: '40 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11 — Writing 4: Discuss Both Views + Paraphrasing',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập Build a sentence', duration: '5 mins' },
      { num: 2, title: 'Approach chung trả lời dạng Discuss Both Views', duration: '30 mins' },
      { num: 3, title: 'Áp dụng Linearthinking cụ thể hoá câu 123813 dạng Discuss Both Views', duration: '30 mins' },
      { num: 4, title: 'Nghệ thuật paraphrasing', duration: '30 mins' },
      { num: 5, title: 'Luyện tập', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Bài tập viết outline 123813 dạng Discuss Both Views', duration: '30 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12 — Speaking 4: Cách sắp xếp ý và trả lời câu hỏi Part 3',
    duration: '200 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức Part 1', duration: '5 mins' },
      { num: 2, title: 'Introduce + Các vấn đề khi trả lời câu hỏi Part 3', duration: '30 mins' },
      { num: 3, title: 'Cách tiếp cận câu hỏi Part 3', duration: '30 mins' },
      { num: 4, title: 'Cách cấu trúc hóa câu trả lời Part 3', duration: '30 mins' },
      { num: 5, title: 'Practice', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening: Cách làm dạng Sentence Completion', duration: '30 mins' },
      { num: 8, title: 'Practice 2 topic Technology + Internet', duration: '40 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13 — Reading 5: Cách làm dạng Gapfill và True/ False/ Not Given',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Multiple Choice và Matching names', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách làm TFNG cũ', duration: '30 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận TFNG', duration: '30 mins' },
      { num: 4, title: 'Tầm quan trọng của việc đọc hiểu trong Gapfill', duration: '30 mins' },
      { num: 5, title: 'Cách IELTSPro tiếp cận Gapfill', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Làm bài đọc: Venus In Transit & Oxytocin', duration: '80 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14 — Writing 5: Agree-Disagree',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Ôn tập 2 dạng Ad/Disad + 2-part questions', duration: '5 mins' },
      { num: 2, title: 'Approach chung trả lời dạng Agree/Disagree', duration: '40 mins' },
      { num: 3, title: 'Áp dụng Linearthinking cụ thể hoá câu 123813 cho Agree/Disagree', duration: '40 mins' },
      { num: 4, title: 'Tổng hợp các model để bật ra ideas bằng Linearthinking', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Bài tập viết outline 123813 dạng Agree/Disagree', duration: '30 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15 — Speaking 5: Kĩ năng phòng thi',
    duration: '230 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách tiếp cận câu hỏi Part 3 trong Speaking + Cách cấu trúc hóa câu trả lời', duration: '5 mins' },
      { num: 2, title: 'Tái hiện lại phòng thi', duration: '10 mins' },
      { num: 3, title: 'Cách trả lời những câu hỏi khó', duration: '20 mins' },
      { num: 4, title: 'Practice', duration: '20 mins' },
      { num: 5, title: 'Extra practice áp dụng vào đề thi Part 3 câu hỏi khó', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening: Cách làm dạng Note Completion (Section 4)', duration: '20 mins' },
      { num: 8, title: 'Practice lại 4 topic Architecture + Marriage + Ethics + Music', duration: '90 mins' },
      { num: 9, title: 'Đọc sample các bài Part 2 để nhận diện tư duy tiếp cận bài nói Part 2', duration: '40 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16 — Reading 6: Cách làm dạng bài Matching Information + Chiến thuật làm Reading hoàn chỉnh',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng Gapfill và True/ False/ Not Given hiệu quả', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng Matching Information', duration: '10 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Matching Information', duration: '20 mins' },
      { num: 4, title: 'Chiến thuật làm bài hoàn chỉnh', duration: '30 mins' },
      { num: 5, title: 'Luyện tập', duration: '60 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Luyện tập thêm bài tập Matching Information trên LMS', duration: '60 mins' },
    ],
  },
  {
    id: 17,
    title: 'Buổi 17 — Writing 6: Detailed outlines',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking để bật ra ideas', duration: '5 mins' },
      { num: 2, title: 'Cách dùng Linearthinking để phát triển ideas (Cause-Effect, Hypothesis, Explanation, Example)', duration: '80 mins' },
      { num: 3, title: 'Áp dụng vào đề bài cụ thể để lập dàn ý', duration: '40 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Lập dàn ý chi tiết cho các đề bài được giao', duration: '60 mins' },
    ],
  },
  {
    id: 18,
    title: 'Buổi 18 — Speaking 6: Introduce Part 2 + Cách approach các dạng đề Part 2',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức quan trọng Part 3', duration: '5 mins' },
      { num: 2, title: 'Introduce các dạng đề Part 2 + Các vấn đề khi trả lời đề Part 2', duration: '30 mins' },
      { num: 3, title: 'Cách trả lời các câu hỏi gợi ý', duration: '20 mins' },
      { num: 4, title: 'Practice', duration: '20 mins' },
      { num: 5, title: 'Cách trả lời câu hỏi “Explain why…?”', duration: '20 mins' },
      { num: 6, title: 'Practice', duration: '20 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Practice lại các topic trên lớp', duration: '60 mins' },
    ],
  },
  {
    id: 19,
    title: 'Buổi 19 — Reading 7: Revision',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Ôn tập', duration: '120 mins' },
    ],
  },
  {
    id: 20,
    title: 'Buổi 20 — Writing 7: Coherence and Cohesion',
    duration: '145 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách lập dàn ý', duration: '5 mins' },
      { num: 2, title: 'Coherence on an essay level', duration: '15 mins' },
      { num: 3, title: 'Coherence on a paragraph level', duration: '15 mins' },
      { num: 4, title: 'Cohesive devices: Linking words, Referencing, Structures', duration: '75 mins' },
      { num: 5, title: 'Practice (bài tập Collocations)', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung cần học', duration: '5 mins' },
    ],
  },
  {
    id: 21,
    title: 'Buổi 21 — Speaking 7: Cách take note cho part 2 + Dạng đề People + Object',
    duration: '220 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách approach bài nói Part 2', duration: '5 mins' },
      { num: 2, title: 'Cách take note hiệu quả cho Part 2', duration: '20 mins' },
      { num: 3, title: 'Cách trả lời Part 2 dựa trên note', duration: '20 mins' },
      { num: 4, title: 'Practice', duration: '20 mins' },
      { num: 5, title: 'Extra practice đề thi thật dạng People + Object', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening: Cách làm dạng Matching', duration: '30 mins' },
      { num: 8, title: 'Practice thêm 3 đề dạng People + 3 đề dạng Object', duration: '60 mins' },
      { num: 9, title: 'Đọc sample bài Part 2 để rút ra vocab nâng cao + ngôn ngữ để cấu trúc hóa bài nói', duration: '40 mins' },
    ],
  },
  {
    id: 22,
    title: 'Buổi 22 — Writing 8: Cách viết bài essay hoàn chỉnh',
    duration: '370 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách viết câu level 7.0', duration: '5 mins' },
      { num: 2, title: 'Cách viết bài essay hoàn chỉnh', duration: '60 mins' },
      { num: 3, title: 'Cách proofread lại bài essay', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung cần học', duration: '5 mins' },
      { num: 5, title: 'Viết full 4 bài Task 2 trên ứng dụng của IELTSPro', duration: '240 mins' },
    ],
  },
  {
    id: 23,
    title: 'Buổi 23 — Speaking 8: Ngôn ngữ nâng cao trong Speaking Part 2 + Dạng đề Place + Event',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách take note hiệu quả', duration: '5 mins' },
      { num: 2, title: 'Ngôn ngữ để cấu trúc hóa bài nói Part 2', duration: '10 mins' },
      { num: 3, title: 'Practice', duration: '20 mins' },
      { num: 4, title: 'Tổng hợp ngôn ngữ mô tả nâng cao trong Part 2: Place, Event, People, Object', duration: '60 mins' },
      { num: 5, title: 'Practice', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening: Cách làm dạng Multiple Choice', duration: '30 mins' },
      { num: 8, title: 'Practice 3 đề topic Place + 3 đề topic Event', duration: '90 mins' },
    ],
  },
  {
    id: 24,
    title: 'Buổi 24 — Writing 9: Ôn tập Writing Task 2',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Ôn tập Writing Task 2', duration: '120 mins' },
    ],
  },
  {
    id: 25,
    title: 'Buổi 25 — Writing 10: Linearthinking trong Writing Task 1',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Các dạng bài trong Task 2', duration: '5 mins' },
      { num: 2, title: 'Cách chọn thông tin cho Overview và Body theo Linearthinking', duration: '60 mins' },
      { num: 3, title: 'Luyện tập', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Luyện tập lập outline cho biểu đồ được giao', duration: '60 mins' },
    ],
  },
  {
    id: 26,
    title: 'Buổi 26 — Speaking 9: Ôn tập',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức quan trọng của từng Part + Cách áp dụng Linearthinking cho Part 1 + 2 + 3', duration: '30 mins' },
      { num: 2, title: 'Luyện tập áp dụng vào đề thi thật', duration: '30 mins' },
      { num: 3, title: 'Practice Part 1', duration: '20 mins' },
      { num: 4, title: 'Practice Part 3', duration: '20 mins' },
      { num: 5, title: 'Practice Part 2', duration: '20 mins' },
      { num: 6, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 7, title: 'Listening: Review kiến thức toàn khóa', duration: '30 mins' },
    ],
  },
  {
    id: 27,
    title: 'Buổi 27 — Writing 11: Cách miêu tả số liệu trong Writing Task 1 và cấu trúc so sánh trong Writing Task 1',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Linearthinking trong Task 1', duration: '5 mins' },
      { num: 2, title: 'Cách miêu tả số liệu trong Task 1', duration: '40 mins' },
      { num: 3, title: 'Cấu trúc câu so sánh trong Writing Task 1', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào bài Task 1', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Viết full bài Graph without Trend trên ứng dụng của IELTSPro', duration: '40 mins' },
    ],
  },
  {
    id: 28,
    title: 'Buổi 28 — Writing 12: Trend Language + Cách viết bài Task 1 hoàn chỉnh',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách so sánh trong Task 1', duration: '10 mins' },
      { num: 2, title: 'Cách sử dụng Language of trend (ngôn ngữ tăng giảm) trong Task 1', duration: '60 mins' },
      { num: 3, title: 'Cách viết mở bài', duration: '20 mins' },
      { num: 4, title: 'Dùng từ liên kết', duration: '10 mins' },
      { num: 5, title: 'Viết 1 bài Task 1 hoàn chỉnh', duration: '30 mins' },
      { num: 6, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 7, title: 'Viết full bài Graph with Trend + Mixed trên ứng dụng của IELTSPro', duration: '60 mins' },
    ],
  },
  {
    id: 29,
    title: 'Buổi 29 — Writing 13: Process',
    duration: '200 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Approach dạng Charts Task 1', duration: '5 mins' },
      { num: 2, title: 'Phân loại dạng Process', duration: '10 mins' },
      { num: 3, title: 'Cách viết Introduction', duration: '20 mins' },
      { num: 4, title: 'Cách viết Overview', duration: '30 mins' },
      { num: 5, title: 'Cách viết Body: Đảm bảo tiêu chí TA, GRA, CC', duration: '70 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Viết full bài Process trên ứng dụng của IELTSPro', duration: '40 mins' },
    ],
  },
  {
    id: 30,
    title: 'Buổi 30 — Writing 14: Map',
    duration: '200 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách viết bài Process hoàn chỉnh', duration: '5 mins' },
      { num: 2, title: 'Map', duration: '30 mins' },
      { num: 3, title: 'Áp dụng Linearthinking vào dạng Map', duration: '60 mins' },
      { num: 4, title: 'Ngôn ngữ chỉ phương hướng + sự thay đổi', duration: '60 mins' },
      { num: 5, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 6, title: 'Viết full bài Map trên ứng dụng của IELTSPro', duration: '40 mins' },
    ],
  },
]

const ielts70Teachers = {
  1: {
    name: 'Cô Hà Đặng Như Quỳnh',
    titleName: 'Cô Hà Đặng Như Quỳnh',
    titlePrefix: 'Cô',
    quoteLabel: 'CÔ',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '9.0 IELTS Overall',
      '9.0 IELTS Speaking',
      '8.5 IELTS Writing',
      'Nghiên cứu sinh – Tiến sĩ (Giảng dạy tiếng Anh)',
      'Thạc sĩ (Giảng dạy ngôn ngữ)',
    ],
    quote: 'Không có học sinh dở, mà chỉ có giáo viên chưa đủ giỏi.',
  },
  2: {
    name: 'Thầy Trần Anh Khoa',
    titleName: 'Thầy Trần Anh Khoa',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '9.0 IELTS Overall',
      '8.5 IELTS Writing',
      '8.5 IELTS Speaking',
      'Thạc sĩ (Giảng dạy tiếng Anh - Edith Cowan University)',
      'Á Khoa (Ngôn ngữ Anh – ĐH KHXH&NV)',
    ],
    quote: 'Bất kể là mình đang dạy cái gì thì khả năng cao là đều có 1 cách nào đó tốt hơn để dạy cái đó. Và nhiệm vụ của 1 giáo viên là tìm cái thứ đó. Và nếu không thì tạo ra thứ đó.',
  },
}

export default function Ielts70() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa IELTS 7.0+ | IELTSPro'
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
            <span className="current">IELTS 7.0+</span>
          </nav>

          {/* 2-Column Grid Layout */}
          <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (lg:col-span-2) */}
            <main className="cd-main lg:col-span-2">
              <HeroSection
                title="Khóa IELTS 7.0+"
                rating="5.0/5"
                reviews="10,000 review"
                teachers={ielts70Teachers}
                description='Đề khó, đề lạ không còn là rào cản. Khoá IELTS 7.0 với phương pháp Linearthinking giúp bạn tăng tốc độ đọc hiểu, "chấp mọi đề" bằng tư duy phát triển ý logic, nâng cao Writing và Speaking thông qua việc hiểu bản chất tiêu chí chấm điểm thay vì học thuộc mẫu hay ghi nhớ máy móc.'
                inputBand="IELTS 6.0"
                outputBand="IELTS 7.0"
              />
              <BenefitsSection outcomes={ielts70Outcomes} />
              <CurriculumSection
                title="Chương trình học 10 tuần"
                headerMeta="30 Buổi · 205 Bài học · 60h học tập"
                sessions={ielts70Sessions}
                unit="buổi"
              />
              <TeachersSection teachers={ielts70Teachers} />
              <CourseScheduleTable title="Lịch học Khóa IELTS 7.0+" scheduleData={schedulesData70} />
            </main>

            {/* Right Column (lg:col-span-1) */}
            <SidebarOffer />
          </div>
        </div>
      </div>
    </>
  )
}
