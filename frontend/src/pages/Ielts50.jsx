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

const ielts50Sessions = [
  {
    id: 1,
    title: 'Buổi 1 — Reading 1: Thay đổi tư duy đọc tiếng Anh',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề tồn đọng của cách đọc dịch/ skimming và scanning', duration: '30 mins' },
      { num: 2, title: 'Áp dụng Linearthinking vào Reading để giải quyết những vấn đề trên', duration: '60 mins' },
      { num: 3, title: 'Áp dụng vào bài đọc thực tế', duration: '30 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Làm bài đọc dangers of the World Wide Web', duration: '30 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2 — Writing 1: Thay đổi tư duy viết tiếng Anh',
    duration: '185 mins',
    lessons: [
      { num: 1, title: 'Hướng dẫn chuyển từ viết dịch sang viết cấu trúc', duration: '' },
      { num: 2, title: 'Tầm quan trọng của việc học viết câu', duration: '20 mins' },
      { num: 3, title: 'Những vấn đề tồn đọng của việc viết dịch', duration: '20 mins' },
      { num: 4, title: 'Viết cấu trúc theo Linearthinking và lợi ích của nó', duration: '20 mins' },
      { num: 5, title: 'Cần học gì để viết cấu trúc tốt?', duration: '' },
      { num: 6, title: 'Cách học vocab đúng', duration: '15 mins' },
      { num: 7, title: 'Cách học cấu trúc câu đúng', duration: '15 mins' },
      { num: 8, title: 'Luyện tập: Các bước để viết một câu đơn đúng', duration: '30 mins' },
      { num: 9, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 10, title: 'Bài tập build a sentence trong sách', duration: '45 mins' },
      { num: 11, title: 'Hệ thống lại các pattern để học', duration: '15 mins' },
    ],
  },
  {
    id: 3,
    title: 'Buổi 3 — Speaking 1: Thay đổi tư duy nói tiếng Anh',
    duration: '185 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề học viên thường gặp khi nói tiếng Anh', duration: '20 mins' },
      { num: 2, title: 'Áp dụng Linearthinking vào Speaking: Speak in structure', duration: '30 mins' },
      { num: 3, title: 'Áp dụng Linear framework để phát triển ý', duration: '40 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Listening 1: Cách tự luyện tập nghe ở nhà', duration: '30 mins' },
      { num: 6, title: 'Tập chép tại nhà Listening Day 02,04', duration: '60 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4 — Reading 2: Cách đọc cấu trúc câu',
    duration: '230 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Đọc cấu trúc theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Những cấu trúc câu cơ bản thường gặp trong bài đọc', duration: '60 mins' },
      { num: 3, title: 'Áp dụng phân tích cấu trúc câu của 2 bài đọc cụ thể', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Ôn lại các sentence structure', duration: '10 mins' },
      { num: 6, title: 'Đọc và trả lời bài crop growing skyscrapers + cigarette smoke', duration: '90 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5 — Writing 2: Cách cải thiện 1 câu và connect 2 câu',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách viết cấu trúc theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Cách self-correct một câu', duration: '40 mins' },
      { num: 3, title: 'Cách cải thiện một câu', duration: '40 mins' },
      { num: 4, title: 'Cách kết nối 2 câu', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Ôn lại kiến thức mới', duration: '10 mins' },
      { num: 7, title: 'Làm LMS build a sentence', duration: '10 mins' },
      { num: 8, title: 'Hoàn thành collocation + học thuộc bài Education', duration: '30 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6 — Speaking 2: Cách phát triển câu trả lời',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Linearthinking trong Speaking', duration: '5 mins' },
      { num: 2, title: 'Xác định vấn đề trong cách phát triển ý của học viên', duration: '20 mins' },
      { num: 3, title: 'Dùng 4W1H để phát triển ý', duration: '20 mins' },
      { num: 4, title: 'Luyện tập phát triển ý', duration: '30 mins' },
      { num: 5, title: 'Cách liên kết giữa hai câu', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 2: Cách làm bài dạng Note Completion', duration: '30 mins' },
      { num: 8, title: 'Listening day 06 + 08', duration: '60 mins' },
      { num: 9, title: 'Làm homework listening week 2', duration: '20 mins' },
      { num: 10, title: 'Practice trả lời trôi chảy question topic daily routine + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7 — Reading 3: Luyện tập Read in structure',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đọc cấu trúc câu', duration: '5 mins' },
      { num: 2, title: 'Áp dụng vào đọc và trả lời câu hỏi Passage 1', duration: '60 mins' },
      { num: 3, title: 'Áp dụng vào đọc và trả lời câu hỏi Passage 2', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Đọc và trả lời bài How to choose the right university + traffic free shopping street', duration: '60 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8 — Writing 3: Cách áp dụng Linearthinking vào Writing Task 2',
    duration: '205 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách cải thiện 1 câu và connect 2 câu', duration: '5 mins' },
      { num: 2, title: 'Sơ lược về Writing Task 2', duration: '30 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking vào Writing Task 2', duration: '60 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Làm LMS collocation', duration: '15 mins' },
      { num: 7, title: 'Học + hoàn thành collocation topic family + relationship', duration: '40 mins' },
      { num: 8, title: 'Generate ideas cho bài taking a gap year', duration: '20 mins' },
    ],
  },
  {
    id: 9,
    title: 'Buổi 9 — Speaking 3: Cách dùng Reason để phát triển ý',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Dùng 4W1H để phát triển ý', duration: '5 mins' },
      { num: 2, title: 'Cách đưa Reason để phát triển ý', duration: '30 mins' },
      { num: 3, title: 'Ngôn ngữ để đưa ra Reason', duration: '30 mins' },
      { num: 4, title: 'Practice luyện tập Reason', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 3: Cách làm bài dạng Flowchart', duration: '30 mins' },
      { num: 7, title: 'Tập chép Listening day 08 + 10', duration: '60 mins' },
      { num: 8, title: 'Làm listening week 3', duration: '20 mins' },
      { num: 9, title: 'Practice trả lời trôi chảy question topic travel + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10 — Reading 4: Cách đọc Connection giữa các câu/ các đoạn + trả lời Multiple Choice',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đọc cấu trúc câu', duration: '5 mins' },
      { num: 2, title: 'Cách Read connection trong Reading', duration: '60 mins' },
      { num: 3, title: 'Cách áp dụng Read connection để trả lời dạng câu Multiple Choice', duration: '30 mins' },
      { num: 4, title: 'Luyện tập Read connection', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Đọc và trả lời bài đọc Stress', duration: '30 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11 — Writing 4: Cách trả lời dạng Advantages & Disadvantages',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking vào Writing', duration: '5 mins' },
      { num: 2, title: 'Outline cho dạng bài Advantages và Disadvantages', duration: '40 mins' },
      { num: 3, title: 'Cách paraphrase đề bài để viết mở bài', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Học outline mẫu theo mindset', duration: '15 mins' },
      { num: 7, title: 'Lên ideas cho bài essay LMS đề bài cheaper product', duration: '20 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12 — Speaking 4: Cách dùng Feelings/ Opinions để phát triển ý',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Dùng Reason để phát triển ý', duration: '5 mins' },
      { num: 2, title: 'Cách đưa Feelings/ Opinions để phát triển ý', duration: '30 mins' },
      { num: 3, title: 'Ngôn ngữ để đưa ra Feelings/ Opinions', duration: '30 mins' },
      { num: 4, title: 'Practice Feelings/ Opinions', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 4: Cách làm bài dạng Multiple Choice', duration: '30 mins' },
      { num: 7, title: 'Tập chép listening day 12 + 14', duration: '60 mins' },
      { num: 8, title: 'Làm listening week 5', duration: '20 mins' },
      { num: 9, title: 'Practice trả lời trôi chảy question topic technology + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13 — Reading 5: Cách trả lời dạng Matching Heading',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách Read connection + cách trả lời câu hỏi Multiple Choice', duration: '5 mins' },
      { num: 2, title: 'Cách trả lời dạng bài Matching Heading', duration: '60 mins' },
      { num: 3, title: 'Áp dụng vào 2 bài đọc cụ thể', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Đọc bài Reading Marriage và Holiday - trả lời các câu matching headings', duration: '60 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14 — Writing 5: Cách trả lời dạng Problems & Solutions',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời dạng Advantages & Disadvantages', duration: '5 mins' },
      { num: 2, title: 'Outline cho dạng bài Problems & Solutions', duration: '40 mins' },
      { num: 3, title: 'Cách generate ideas cho dạng Problems & Solutions', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Học outline dạng mới', duration: '20 mins' },
      { num: 7, title: 'Viết essay advantages và disadvantages trên LMS', duration: '40 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15 — Speaking 5: Cách đưa câu Statement tốt',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Dùng Feelings/ Opinions để phát triển ý', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách đưa Statement cũ', duration: '20 mins' },
      { num: 3, title: 'Cách đưa câu Statement tốt hơn', duration: '' },
      { num: 4, title: 'Dạng câu hỏi Preferences', duration: '15 mins' },
      { num: 5, title: 'Dạng câu hỏi Yes/ No', duration: '15 mins' },
      { num: 6, title: 'Practice đưa câu Statement', duration: '40 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Listening 5: Cách làm bài dạng Gapfill/ Short answer', duration: '30 mins' },
      { num: 9, title: 'Tập chép listening day 16 + 18', duration: '60 mins' },
      { num: 10, title: 'Làm listening week 6', duration: '20 mins' },
      { num: 11, title: 'Practice trả lời trôi chảy question topic shopping + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16 — Reading 6: Luyện tập cách đọc connection để làm Matching Heading',
    duration: '215 mins',
    lessons: [
      { num: 1, title: 'Ôn tập cách đọc connection', duration: '5 mins' },
      { num: 2, title: 'Luyện tập: Xác định loại mối quan hệ giữa hai câu', duration: '40 mins' },
      { num: 3, title: 'Luyện tập: Tóm tắt nội dung 2 câu', duration: '40 mins' },
      { num: 4, title: 'Luyện tập: Áp dụng đọc connection để làm Matching Heading', duration: '40 mins' },
      { num: 5, title: 'Làm Australian and culture shock + US city and the environment phần matching headings', duration: '90 mins' },
    ],
  },
  {
    id: 17,
    title: 'Buổi 17 — Writing 6: Luyện tập giải đề',
    duration: '185 mins',
    lessons: [
      { num: 1, title: 'Ôn tập outline dạng Advantages và Disadvantages', duration: '10 mins' },
      { num: 2, title: 'Ôn tập outline dạng Problems and Solutions', duration: '10 mins' },
      { num: 3, title: 'Luyện tập: paragraph building', duration: '40 mins' },
      { num: 4, title: 'Luyện tập: Giải đề thi thật dạng Advantages/ Disadvantages và Problems/ Solutions', duration: '60 mins' },
      { num: 5, title: 'Giao homework', duration: '5 mins' },
      { num: 6, title: 'Viết LMS bài causes - solution', duration: '60 mins' },
    ],
  },
  {
    id: 18,
    title: 'Buổi 18 — Speaking 6: Kết hợp thành câu trả lời hoàn chỉnh',
    duration: '245 mins',
    lessons: [
      { num: 1, title: 'Ôn tập các công cụ phát triển ý', duration: '15 mins' },
      { num: 2, title: 'Ôn tập cách đưa câu Statement hay', duration: '15 mins' },
      { num: 3, title: 'Luyện tập: Áp dụng vào câu hỏi thực tế', duration: '60 mins' },
      { num: 4, title: 'Giao homework', duration: '5 mins' },
      { num: 5, title: 'Listening 6: Luyện tập nghe trên lớp', duration: '30 mins' },
      { num: 6, title: 'Tập chép listening day 20 + 22', duration: '60 mins' },
      { num: 7, title: 'Làm listening week 4', duration: '20 mins' },
      { num: 8, title: 'Practice trả lời trôi chảy question topic technology + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 19,
    title: 'Buổi 19 — Reading 7: Cách làm dạng bài Gapfill',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Matching Heading', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng Gapfill', duration: '30 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Gapfill', duration: '30 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc', duration: '60 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Hoàn thành gap fill các bài holidays + australian and culture shock', duration: '60 mins' },
    ],
  },
  {
    id: 20,
    title: 'Buổi 20 — Writing 7: Cách miêu tả số liệu trong Writing Task 1',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking trong Task 2', duration: '5 mins' },
      { num: 2, title: 'Cách miêu tả số liệu trong Task 1', duration: '60 mins' },
      { num: 3, title: 'Cách đọc và hiểu biểu đồ', duration: '30 mins' },
      { num: 4, title: 'Áp dụng: Viết bài phân tích Pie chart', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Hoàn thành bài report page 112 + 114', duration: '60 mins' },
    ],
  },
  {
    id: 21,
    title: 'Buổi 21 — Speaking 7: Cách trả lời câu hỏi Speaking Part 1',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đưa câu Statement tốt hơn', duration: '5 mins' },
      { num: 2, title: 'Framework cho Speaking Part 1', duration: '30 mins' },
      { num: 3, title: 'Cách đưa Statement cho Speaking Part 1', duration: '30 mins' },
      { num: 4, title: 'Luyện tập trả lời câu Speaking Part 1 hoàn chỉnh', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 7: Cách làm bài dạng Map', duration: '30 mins' },
      { num: 7, title: 'Tập chép listening day 26 + 28', duration: '60 mins' },
      { num: 8, title: 'Làm listening week 6', duration: '20 mins' },
      { num: 9, title: 'Practice trả lời trôi chảy question topic study abroad + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 22,
    title: 'Buổi 22 — Reading 8: Cách làm dạng bài True/ False/ Not Given',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Gapfill', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng True/ False/ Not Given', duration: '30 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng True/ False/ Not Given', duration: '30 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc', duration: '60 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Làm bài Is constant use of media changing our minds?', duration: '40 mins' },
      { num: 7, title: 'Làm phần TFNG các bài marriage + U city + Australian', duration: '20 mins' },
    ],
  },
  {
    id: 23,
    title: 'Buổi 23 — Writing 8: Cấu trúc so sánh trong Writing Task 1',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách miêu tả số liệu trong Task 1', duration: '5 mins' },
      { num: 2, title: 'Cấu trúc câu so sánh trong Writing Task 1', duration: '60 mins' },
      { num: 3, title: 'Áp dụng cấu trúc so sánh vào bài Task 1', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'LMS bài bar chart', duration: '30 mins' },
    ],
  },
  {
    id: 24,
    title: 'Buổi 24 — Speaking 8: Cách trả lời câu hỏi Speaking Part 3',
    duration: '250 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Part 1', duration: '5 mins' },
      { num: 2, title: 'Vấn đề khi phát triển ideas cho part 3', duration: '20 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để phát triển ideas cho part 3', duration: '40 mins' },
      { num: 4, title: 'Practice trả lời Part 3', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 8: Cách làm bài dạng Note Completion', duration: '30 mins' },
      { num: 7, title: 'Tập chép listening day 30 + 32', duration: '60 mins' },
      { num: 8, title: 'Làm listening week 4', duration: '20 mins' },
      { num: 9, title: 'Practice trả lời trôi chảy question topic technology + học collocation liên quan', duration: '40 mins' },
    ],
  },
  {
    id: 25,
    title: 'Buổi 25 — Reading 9: Tổng kết và ôn tập',
    duration: '125 mins',
    lessons: [
      { num: 1, title: 'Ôn tập cách áp dụng tư duy Linearthinking (đọc cấu trúc và đọc connection) trong Reading', duration: '40 mins' },
      { num: 2, title: 'Ôn tập cách trả lời các dạng câu hỏi trong Reading', duration: '60 mins' },
      { num: 3, title: 'Áp dụng vào bài đọc hoàn chỉnh', duration: '20 mins' },
      { num: 4, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
    ],
  },
  {
    id: 26,
    title: 'Buổi 26 — Writing 9: Ngôn ngữ tăng giảm + Viết bài Task 1 hoàn chỉnh',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách so sánh trong Task 1', duration: '30 mins' },
      { num: 2, title: 'Cách sử dụng Language of trend (ngôn ngữ tăng giảm) trong Task 1', duration: '40 mins' },
      { num: 3, title: 'Cách viết Introduction và Overview cho bài Task 1', duration: '40 mins' },
      { num: 4, title: 'Viết 1 bài Task 1 hoàn chỉnh', duration: '40 mins' },
      { num: 5, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
    ],
  },
  {
    id: 27,
    title: 'Buổi 27 — Speaking 9: Tổng kết và ôn tập',
    duration: '155 mins',
    lessons: [
      { num: 1, title: 'Ôn tập từ vựng các chủ đề', duration: '60 mins' },
      { num: 2, title: 'Ôn tập cách áp dụng Linearthinking cho part 1', duration: '30 mins' },
      { num: 3, title: 'Ôn tập cách áp dụng Linearthinking cho part 3', duration: '30 mins' },
      { num: 4, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 5, title: 'Listening 9: Ôn tập cách làm các dạng bài', duration: '30 mins' },
    ],
  },
]

const ielts50Teachers = {
  1: {
    name: 'Thầy Chung Văn Thông',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador - Sứ giả Linearthinking IELTSPro',
      '8.5 IELTS Overall',
      '8.0 IELTS Speaking',
      '8.0 IELTS Writing',
      'Thạc sĩ Applied Linguistics',
      'Cử nhân Sư phạm Anh',
    ],
    quote: "To be a professional ESL teacher and continue to grow on your teaching journey, it's important to craft an ESL philosophy of teaching statement.",
  },
  2: {
    name: 'Thầy Trương Đức Dũng',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador - Sứ giả Linearthinking IELTSPro',
      '8.0 IELTS Overall',
      'Cử nhân Sư phạm Anh – ĐH Sư Phạm HCM',
      'Cử nhân Sư phạm Sinh – ĐH Sư Phạm HCM',
    ],
    quote: 'Không dạy những gì giáo viên biết, chỉ dạy những gì học viên cần.',
  },
}

const ielts50Schedules = [
  { id: 1, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 2, startDate: '30/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, Phường 11, Bình Thạnh, TP.HCM' },
  { id: 3, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 4, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 5, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Hiệp Phú, TP.Thủ Đức, TP.HCM' },
  { id: 6, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, Phường 11, Bình Thạnh, TP.HCM' },
  { id: 7, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 8, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 9, startDate: '31/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '18:00 - 20:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 10, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 11, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Đà Nẵng', address: 'Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q.Hải Châu, Đà Nẵng' },
  { id: 12, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '14:00 - 17:00', location: 'Hà Nội - Thanh Xuân', address: 'Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 13, startDate: '24/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 14, startDate: '31/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 15, startDate: '23/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 16, startDate: '04/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Hà Nội - Thanh Xuân', address: 'Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 17, startDate: '05/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Đà Nẵng', address: 'Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q.Hải Châu, Đà Nẵng' },
  { id: 18, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 19, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 20, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Hà Nội - Đống Đa', address: 'Tầng G, số 158 Phố Chùa Láng, P.Láng Thượng, Q.Đống Đa, Hà Nội' },
  { id: 21, startDate: '11/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 22, startDate: '10/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Hiệp Phú, TP.Thủ Đức, TP.HCM' },
  { id: 23, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 24, startDate: '31/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 25, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 26, startDate: '28/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 27, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 28, startDate: '29/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 29, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 30, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 31, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 32, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 33, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '18:00 - 20:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 34, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 35, startDate: '24/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Hà Nội - Thanh Xuân', address: 'Lầu 2, Tòa nhà Gold Tower, 275 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
  { id: 36, startDate: '10/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 37, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Hiệp Phú, TP.Thủ Đức, TP.HCM' },
  { id: 38, startDate: '05/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 39, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, Phường Tân Chánh Hiệp, Q.12, TP.HCM' },
  { id: 40, startDate: '06/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 41, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 3/5/7', time: '17:30 - 19:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, Phường Tân Chánh Hiệp, Q.12, TP.HCM' },
  { id: 42, startDate: '02/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 43, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 44, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 45, startDate: '23/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, Phường 11, Bình Thạnh, TP.HCM' },
  { id: 46, startDate: '05/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 47, startDate: '07/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 48, startDate: '27/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 12', address: '1038-1040 Nguyễn Ảnh Thủ, Phường Tân Chánh Hiệp, Q.12, TP.HCM' },
  { id: 49, startDate: '30/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '20:00 - 22:00', location: 'Hà Nội - Đống Đa', address: 'Tầng G, số 158 Phố Chùa Láng, P.Láng Thượng, Q.Đống Đa, Hà Nội' },
  { id: 50, startDate: '10/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '17:30 - 19:30', location: 'Bình Thạnh NVĐ', address: '183c Nguyễn Văn Đậu, Phường 11, Bình Thạnh, TP.HCM' },
  { id: 51, startDate: '02/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 52, startDate: '29/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 53, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 54, startDate: '01/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 55, startDate: '08/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
  { id: 56, startDate: '11/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Gò Vấp', address: '95-97 Đường số 3, Khu Cityland Park Hills, P10, Gò Vấp, TP.HCM' },
  { id: 57, startDate: '27/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Đà Nẵng', address: 'Tầng 3, Thư Dung Plaza, 87 Nguyễn Văn Linh, Q.Hải Châu, Đà Nẵng' },
  { id: 58, startDate: '05/08/2026', courseName: 'Khóa IELTS 5.0', status: 'Hết chỗ', schedule: 'Thứ 2/4/6', time: '20:00 - 22:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 59, startDate: '25/07/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 3/5/7', time: '19:30 - 21:30', location: 'Thủ Đức - Quận 9', address: 'Tầng 4 - 25B Lê Văn Việt, Hiệp Phú, TP.Thủ Đức, TP.HCM' },
  { id: 60, startDate: '07/09/2026', courseName: 'Khóa IELTS 5.0', status: 'Còn chỗ', schedule: 'Thứ 2/4/6', time: '19:30 - 21:30', location: 'Tân Phú - Tân Thắng', address: '123 Tân Thắng, Tân Sơn Nhì, TP.HCM' },
]

export default function Ielts50() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa IELTS 5.0+ | IELTSPro'
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
          <span className="current">IELTS 5.0+</span>
        </nav>

        {/* 2-Column Grid Layout */}
        <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column (lg:col-span-2) */}
          <main className="cd-main lg:col-span-2">
            <HeroSection
              title="Khóa IELTS 5.0+"
              inputBand="IELTS 4.0"
              outputBand="IELTS 5.0"
              teachers={ielts50Teachers}
              description="Không chỉ học cách trả lời đúng, khoá IELTS 5.0 giúp bạn biết cách diễn đạt và phát triển ý tưởng một cách tự nhiên. Thông qua phương pháp Linearthinking, bạn rèn luyện phản xạ sử dụng tiếng Anh, củng cố nền tảng ngôn ngữ và từng bước làm chủ tư duy cần thiết để chinh phục các mục tiêu IELTS cao hơn."
            />
            <BenefitsSection
              outcomes={[
                'Loại bỏ hoàn toàn tư duy đọc dịch, viết dịch, nói dịch',
                'Áp dụng phương pháp tư duy để học tiếng Anh hiệu quả',
                'Củng cố và mở rộng vốn từ vựng, ngữ pháp',
                'Nói, viết được nhiều câu đúng, liên tiếp và mạch lạc',
                'Có khả năng diễn đạt, phát triển ý tưởng trôi chảy, tự nhiên hơn',
                'Đọc hiểu nhanh và chính xác của toàn bộ bài để trả lời câu hỏi',
                'Có kiến thức cơ bản về cấu trúc và cách tiếp cận các dạng bài thi IELTS',
              ]}
            />
            <CurriculumSection
              title="Chương trình học 9 tuần"
              headerMeta="27 Buổi · 188 Bài học · 54h học tập"
              sessions={ielts50Sessions}
              unit="buổi"
            />
            <TeachersSection teachers={ielts50Teachers} />
            <CourseScheduleTable title="Lịch học Khóa IELTS 5.0" scheduleData={ielts50Schedules} />
          </main>

          {/* Right Column (lg:col-span-1) */}
          <SidebarOffer />
        </div>
      </div>
    </div>
  </>
)
}
