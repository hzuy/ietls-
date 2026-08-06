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

const preIeltsSchedules = [
  { id: 1, startDate: '01/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Đà Nẵng', address: 'Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Phường Phước Ninh, Quận Hải Châu, Đà Nẵng' },
  { id: 2, startDate: '27/07/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Tân Phú - Lũy Bán Bích', address: '797-799 Đ. Lũy Bán Bích, Phú Thọ Hòa, TP.HCM' },
  { id: 3, startDate: '30/07/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Hà Nội - Đống Đa', address: 'Tầng G, số 158 Phố Chùa Láng, P.Láng Thượng, Q.Đống Đa, Hà Nội' },
  { id: 4, startDate: '27/07/2026', courseName: 'Khóa PRE IELTS', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 5, startDate: '01/08/2026', courseName: 'Khóa PRE IELTS', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 6, startDate: '11/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, Phường 11, Bình Thạnh, TP.HCM' },
  { id: 7, startDate: '03/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 8, startDate: '10/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 9, startDate: '11/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM (đối diện Lotte Mart)' },
  { id: 10, startDate: '10/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, Phường Tân Chánh Hiệp, Quận 12, TP.HCM' },
  { id: 11, startDate: '10/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 12, startDate: '04/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 13, startDate: '11/08/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Phường Hiệp Phú, Thành Phố Thủ Đức (sát Vincom Plaza), TP.HCM' },
  { id: 14, startDate: '12/09/2026', courseName: 'Khóa PRE IELTS', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Tân Phú - Tân Thắng', address: '123 Tân Thắng, Tân Sơn Nhì, TP.HCM' },
]

const preIeltsOutcomes = [
  'Định hướng lại cách học tiếng Anh đúng, từ đó trở nên yêu thích việc học hơn',
  'Hiểu được bản chất của tiếng Anh và sự khác biệt giữa tiếng Anh và tiếng Việt',
  'Biết cách học từ vựng, ngữ pháp hiệu quả, dễ nhớ & dễ áp dụng',
  'Có khả năng nối từ thành cụm, từ đó viết thành câu hoàn chỉnh',
  'Tích lũy vốn từ cơ bản nhất, áp dụng được cho kỹ năng Nghe – Nói – Đọc – Viết',
]

const preIeltsSessions = [
  {
    id: 1,
    title: 'Buổi 1: Hiểu về bản chất việc học tiếng Anh',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Chỉ ra vấn đề của cách học tiếng Anh cũ', duration: '20 mins' },
      { num: 2, title: 'Giới thiệu tư duy học tiếng Anh đúng', duration: '20 mins' },
      { num: 3, title: 'Giới thiệu từng dạng Word Form', duration: '20 mins' },
      { num: 4, title: 'Giới thiệu Word Pattern', duration: '20 mins' },
      { num: 5, title: 'Giới thiệu vị trí Word Form', duration: '20 mins' },
      { num: 6, title: 'Giới thiệu về cấu trúc câu', duration: '20 mins' },
      { num: 7, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 8, title: 'Bài tập xác định word form, word pattern để đặt câu với 3 từ Balance - Cause - Lack', duration: '30 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2: Cách học từ vựng hiệu quả - Tích luỹ từ vựng chủ đề Education',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Giới thiệu từ vựng chủ đề Education', duration: '5 mins' },
      { num: 3, title: 'Chỉ ra vấn đề của cách học từ vựng cũ', duration: '30 mins' },
      { num: 4, title: 'Lợi ích cách học từ vựng theo mô hình tư duy (mental model) của IeltsPro', duration: '40 mins' },
      { num: 5, title: 'Học từ vựng chủ đề Education (nghĩa của từ, phát âm, word form, word pattern,...)', duration: '40 mins' },
      { num: 6, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 7, title: 'Bài tập ôn vocabs đã học', duration: '30 mins' },
      { num: 8, title: 'Bài tập xác định vị trí của Noun trong câu', duration: '30 mins' },
    ],
  },
  {
    id: 3,
    title: 'Buổi 3: Làm quen với Danh từ (Noun) - Phân tích vị trí và các dạng thức của Danh Từ',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Các dạng thức của Danh Từ', duration: '20 mins' },
      { num: 3, title: 'Vị trí của Danh Từ trong câu', duration: '30 mins' },
      { num: 4, title: 'Chức năng của Danh từ (Determiner)', duration: '30 mins' },
      { num: 5, title: 'Luyện tập', duration: '30 mins' },
      { num: 6, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 7, title: 'Áp dụng từ vựng và cấu trúc đã học, hoàn thành bài viết về Advantages và Disadvantages của Online Learning và Studying Abroad', duration: '60 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4: Ôn tập về Danh từ (vị trí - các dạng thức - chức năng)',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Nghe bài nghe thuộc chủ đề Education, cho học viên ôn lại vocab đã học', duration: '40 mins' },
      { num: 3, title: 'Ôn tập lại kiến thức về Noun đã học (loại từ, vị trí từ,...)', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Tổng hợp vocabs đã học trong topic Education theo mental models giáo viên gợi ý', duration: '30 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5: Làm quen với Động từ (Verb) và Verb patterns - Học từ vựng chủ đề Hobbies và Interest',
    duration: '140 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Giới thiệu từ vựng chủ đề Hobbies và Interest (Types of hobbies, benefits, related vocab)', duration: '30 mins' },
      { num: 3, title: 'Giới thiệu động từ và Verb patterns phổ biến để nói về lợi ích và sở thích', duration: '40 mins' },
      { num: 4, title: 'Practice', duration: '40 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Thu âm bài nói về hobbies của mình', duration: '10 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6: Phân tích vị trí và các dạng thức của Động Từ - Học từ vựng chủ đề Travel',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Đọc bài đọc liên quan chủ đề Travel', duration: '30 mins' },
      { num: 3, title: 'Rút ra các dạng thức của động từ và vị trí động từ trong câu', duration: '30 mins' },
      { num: 4, title: 'Học vocab liên quan chủ đề Travel từ bài đọc', duration: '30 mins' },
      { num: 5, title: 'Sắp xếp vocab theo mental model', duration: '20 mins' },
      { num: 6, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 7, title: 'Viết về 1 chuyến đi của mình với các vocabs đã học', duration: '30 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7: Ôn tập về Động từ (vị trí - các dạng thức)',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Nghe bài nghe thuộc chủ đề Hobbies và Interest, cho học viên ôn lại vocab đã học', duration: '40 mins' },
      { num: 3, title: 'Ôn tập lại các điểm ngữ pháp đã học (loại từ, vị trí từ,...)', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Tổng hợp vocabs đã học trong topic Hobbies & Interests theo mental models giáo viên gợi ý', duration: '30 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8: Làm quen với Tính từ (Adjective) - Phân tích vị trí của Tính từ trong câu',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Luyện tập nghe - Học các vocab chưa biết từ bài nghe', duration: '30 mins' },
      { num: 3, title: 'Làm quen với Tính từ và vị trí của Tính từ trong câu', duration: '40 mins' },
      { num: 4, title: 'Học Verb patterns diễn đạt cảm xúc, áp dụng các tính từ vừa học', duration: '40 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Viết lại các câu với gợi ý cho sẵn', duration: '20 mins' },
    ],
  },
  {
    id: 9,
    title: 'Buổi 9: Làm quen với Trạng từ - Phân tích cách sử dụng Trạng từ trong câu',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học các trạng từ chỉ tần suất và vị trí của trạng từ', duration: '40 mins' },
      { num: 3, title: 'Áp dụng vào bài tập', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Ôn lại bài & các vị trí của adverbs', duration: '15 mins' },
      { num: 6, title: 'Ôn lại tất cả vocabs của các topics đã học', duration: '30 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10: Ôn tập tổng quát tất cả các loại từ (Danh từ - Động từ - Tính từ - Trạng từ)',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Ôn tập Danh từ', duration: '30 mins' },
      { num: 2, title: 'Ôn tập Động từ', duration: '30 mins' },
      { num: 3, title: 'Ôn tập Tính từ - trạng từ', duration: '40 mins' },
      { num: 4, title: 'Ôn tập vị trí các từ trong câu', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Thu âm bài nói giới thiệu về bản thân mình theo những gợi ý trong handout', duration: '20 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11: Cách cấu thành một câu hoàn chỉnh',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Cách ghép các loại từ để hình thành một cụm', duration: '40 mins' },
      { num: 3, title: 'Cấu trúc một câu và các bước ghép thành câu hoàn chỉnh', duration: '40 mins' },
      { num: 4, title: 'Luyện tập: viết câu', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Viết câu dựa trên gợi ý tiếng Việt', duration: '30 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12: Luyện tập viết câu hoàn chỉnh',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa homework', duration: '15 mins' },
      { num: 2, title: 'Luyện tập: Ghép từ thành câu hoàn chỉnh', duration: '40 mins' },
      { num: 3, title: 'Luyện tập: Dùng vocab đã học, tự viết một câu hoàn chỉnh', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13: Mối liên hệ giữa Writing và Reading - Cách áp dụng cấu trúc câu trong Writing vào đọc đoạn trong Reading',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Hướng dẫn học viên cách áp dụng cấu trúc câu để đọc bài Reading', duration: '40 mins' },
      { num: 3, title: 'Tóm tắt nội dung bài học + trả lời câu hỏi', duration: '40 mins' },
      { num: 4, title: 'Luyện tập: Áp dụng vào đoạn văn', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Viết 1 bài văn ngắn nói về lợi ích của việc đọc với các vocabs đã học', duration: '30 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14: Tích luỹ từ vựng cho topic Work theo mô hình tư duy (mental model)',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học từ vựng liên quan tới chủ đề Work', duration: '40 mins' },
      { num: 3, title: 'Sắp xếp các từ vựng theo mental model', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Xem và học phần related vocabulary để hoàn thành bài về nhà - viết câu theo gợi ý cho sẵn', duration: '60 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15: Ôn tập các từ vựng trong topic Work và phân loại từ vựng theo chức năng',
    duration: '140 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Dùng từ vựng đã học nói cảm nhận (feelings) về các ngành nghề', duration: '30 mins' },
      { num: 3, title: 'Dùng từ vựng đã học miêu tả các ngành nghề', duration: '30 mins' },
      { num: 4, title: 'Dùng từ vựng đã học nói về lợi/ hại của các ngành nghề', duration: '40 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Ôn lại vocabs của topic WORK đã học', duration: '20 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16: Áp dụng từ vựng topic Work vào các kỹ năng Đọc - Nghe - Nói',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Áp dụng từ vựng topic Work vào bài nói', duration: '30 mins' },
      { num: 3, title: 'Áp dụng từ vựng topic Work vào bài đọc', duration: '40 mins' },
      { num: 4, title: 'Áp dụng tư vựng topic Work vào bài nghe', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Nghe lại bài nghe & nói lại, tập pronunciation & listening skills', duration: '30 mins' },
    ],
  },
  {
    id: 17,
    title: 'Buổi 17: Tích luỹ từ vựng cho topic Family theo mô hình tư duy (mental model)',
    duration: '140 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học từ vựng liên quan tới chủ đề Family', duration: '40 mins' },
      { num: 3, title: 'Sắp xếp các từ vựng theo mental model', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Ôn lại vocabs bằng cách chia ra Advantages & Disadvantages của từng dạng family structure', duration: '20 mins' },
    ],
  },
  {
    id: 18,
    title: 'Buổi 18: Ôn tập các từ vựng trong topic Family và phân loại từ vựng theo chức năng',
    duration: '140 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Dùng từ vựng đã học nói về lợi/ hại của các loại gia đình', duration: '40 mins' },
      { num: 3, title: 'Áp dụng từ vựng và ideas đã học để trả lời Speaking', duration: '40 mins' },
      { num: 4, title: 'Làm bài tập build a sentence (viết câu) với từ vựng đã học', duration: '20 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Viết câu dựa trên gợi ý & vocabs đã học', duration: '20 mins' },
    ],
  },
  {
    id: 19,
    title: 'Buổi 19: Chuyên đề Listening',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Chỉ ra vấn đề của việc luyện nghe theo cách hiện tại', duration: '10 mins' },
      { num: 3, title: 'Làm bài nghe đơn giản với topic Family, từ đó rút ra bước 1 để tiến bộ Listening', duration: '30 mins' },
      { num: 4, title: 'Làm bài nghe mức độ trung bình với topic Work, từ đó rút ra bước 2 để tiến bộ Listening', duration: '30 mins' },
      { num: 5, title: 'Làm bài nghe mức độ trung bình với topic Family, từ đó rút ra bước 3 để tiến bộ Listening', duration: '30 mins' },
      { num: 6, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 7, title: 'Nghe lại bài nghe & tập theo 3 bước tiến bộ Listening', duration: '60 mins' },
    ],
  },
  {
    id: 20,
    title: 'Buổi 20: Tích luỹ từ vựng cho topic Food theo mô hình tư duy (mental model)',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học từ vựng liên quan tới chủ đề Food', duration: '40 mins' },
      { num: 3, title: 'Sắp xếp các từ vựng theo mental model', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Viết công thức nấu ăn cho 1 món bất kì với từ vựng đã học', duration: '30 mins' },
    ],
  },
  {
    id: 21,
    title: 'Buổi 21: Ôn tập các từ vựng trong topic Food và phân loại từ vựng theo chức năng',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Áp dụng từ vựng vào đọc hiểu bài đọc', duration: '30 mins' },
      { num: 3, title: 'Sắp xếp từ vựng theo advantage/ disadvantage', duration: '30 mins' },
      { num: 4, title: 'Áp dụng từ vựng và ideas đã học vào tranh luận “Is it better to eat at home or eat out?”', duration: '20 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Viết câu dựa trên gợi ý & vocabs đã học', duration: '20 mins' },
    ],
  },
  {
    id: 22,
    title: 'Buổi 22: Áp dụng từ vựng topic Food vào các kỹ năng Đọc - Nghe - Nói',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Áp dụng từ vựng topic Food vào bài nói', duration: '30 mins' },
      { num: 3, title: 'Áp dụng từ vựng topic Food vào bài đọc', duration: '40 mins' },
      { num: 4, title: 'Áp dụng tư vựng topic Food vào bài nghe', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Nghe lại bài nghe & ôn tập vocabs trong topic FOOD bằng cách sắp xếp lại theo mental models được gợi ý bởi giáo viên', duration: '30 mins' },
    ],
  },
  {
    id: 23,
    title: 'Buổi 23: Tích luỹ từ vựng cho topic Traffic theo mô hình tư duy (mental model)',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học từ vựng liên quan tới chủ đề Traffic', duration: '40 mins' },
      { num: 3, title: 'Sắp xếp các từ vựng theo mental model', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Tập đưa direction từ nhà/ hoặc 1 địa điểm yêu thích tới IeltsPro', duration: '30 mins' },
    ],
  },
  {
    id: 24,
    title: 'Buổi 24: Ôn tập các từ vựng trong topic Traffic và phân loại từ vựng theo chức năng',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Học từ vựng liên quan tới các loại hình giao thông', duration: '40 mins' },
      { num: 3, title: 'Sắp xếp từ vựng theo Ads/ Disadvantages của từng loại hình giao thông', duration: '60 mins' },
      { num: 4, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 5, title: 'Viết bài luận văn nhỏ thảo luận về các dạng phương tiện giao thông', duration: '30 mins' },
    ],
  },
  {
    id: 25,
    title: 'Buổi 25: Áp dụng từ vựng topic Traffic vào các kỹ năng Đọc - Nghe - Nói',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Áp dụng từ vựng topic Traffic vào bài nói', duration: '30 mins' },
      { num: 3, title: 'Áp dụng từ vựng topic Traffic vào bài đọc', duration: '40 mins' },
      { num: 4, title: 'Áp dụng tư vựng topic Traffic vào bài nghe', duration: '30 mins' },
      { num: 5, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
      { num: 6, title: 'Ôn tập tất cả các kiến thức đã học (các dạng word form + từ vựng các chủ đề)', duration: '60 mins' },
    ],
  },
  {
    id: 26,
    title: 'Buổi 26: Ôn tập tổng hợp từ vựng các chủ đề',
    duration: '130 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '15 mins' },
      { num: 2, title: 'Ôn tập từ vựng chủ đề Work', duration: '30 mins' },
      { num: 3, title: 'Ôn tập từ vựng chủ đề Family', duration: '30 mins' },
      { num: 4, title: 'Ôn tập từ vựng chủ đề Food', duration: '30 mins' },
      { num: 5, title: 'Ôn tập từ vựng chủ đề Traffic', duration: '20 mins' },
      { num: 6, title: 'Tổng kết nội dung bài học + giao Homework', duration: '5 mins' },
    ],
  },
  {
    id: 27,
    title: 'Buổi 27: Kiểm tra cuối khoá',
    duration: '120 mins',
    lessons: [
      { num: 1, title: 'Ôn tập nội dung bài cũ + Sửa Homework', duration: '30 mins' },
      { num: 2, title: 'Làm bài kiểm tra cuối khoá', duration: '60 mins' },
      { num: 3, title: 'Nhận xét sự tiến bộ sau khoá học + đưa lộ trình học tiếp', duration: '30 mins' },
    ],
  },
]

const preIeltsTeachers = {
  1: {
    name: 'Thầy Phùng Minh Trí',
    titleName: 'Thầy Phùng Minh Trí',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '8.5 IELTS Overall',
      '8.0 IELTS Speaking',
      '8.0 IELTS Writing',
      'Cử nhân Ngôn Ngữ Anh - ĐH Tôn Đức Thắng',
    ],
    quote: 'Một người giáo viên giỏi là một người có thể làm cho học viên của mình cảm thấy học như không học.',
  },
  2: {
    name: 'Cô Nguyễn Tố Nga',
    titleName: 'Cô Nguyễn Tố Nga',
    titlePrefix: 'Cô',
    quoteLabel: 'CÔ',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '8.0 IELTS Overall',
    ],
    quote: 'Một lớp học sẽ là một thế giới nhỏ an toàn nơi mọi người được quan tâm và tự do nói lên suy nghĩ của mình',
  },
}

export default function PreIelts() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa Pre IELTS | IELTSPro'
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
            <span className="current">Pre IELTS</span>
          </nav>

          {/* 2-Column Grid Layout */}
          <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (lg:col-span-2) */}
            <main className="cd-main lg:col-span-2">
              <HeroSection
                title="Khóa Pre IELTS"
                rating="5.0/5"
                reviews="10,000 review"
                teachers={preIeltsTeachers}
                description="Bạn học tiếng Anh nhiều năm nhưng vẫn cảm thấy kiến thức rời rạc, khó áp dụng? Khóa Pre IELTS với phương pháp Linearthinking giúp bạn hiểu bản chất tiếng Anh, tư duy logic và tiến bộ rõ ràng sau từng buổi học. Sau khoá học, bạn không chỉ xây lại nền tảng mà còn tìm lại sự tự tin, tình yêu và hứng thú với tiếng Anh."
                inputBand="Mất gốc"
                outputBand="Xây nền vững chắc"
              />
              <BenefitsSection outcomes={preIeltsOutcomes} />
              <CurriculumSection
                title="Chương trình học 9 tuần"
                headerMeta="27 Buổi · 157 Bài học · 54h học tập"
                sessions={preIeltsSessions}
                unit="buổi"
              />
              <TeachersSection teachers={preIeltsTeachers} />
              <CourseScheduleTable title="Lịch học Khóa Pre IELTS" scheduleData={preIeltsSchedules} />
            </main>

            {/* Right Column (lg:col-span-1) */}
            <SidebarOffer />
          </div>
        </div>
      </div>
    </>
  )
}
