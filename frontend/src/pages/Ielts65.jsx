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

const schedulesData65 = schedulesData.map(item => ({ ...item, course: 'Khóa IELTS 6.5' }))

const ielts65Outcomes = [
  'Áp dụng tư duy học bản chất, bỏ thói quen đọc dịch, viết dịch, nói dịch',
  'Có kiến thức về cấu trúc và cách tiếp cận bài thi IELTS hiệu quả',
  'Vận dụng vốn từ vựng và ngữ pháp để viết, nói 1 bài lưu loát, tự nhiên & logic',
  'Đọc hiểu được các bài khó, lạ mà không bị phụ thuộc nhiều vào từ vựng',
  'Kết hợp chiến lược làm bài và phương pháp thông minh để tối ưu điểm số',
]

const ielts65Sessions = [
  {
    id: 1,
    title: 'Buổi 1 — Reading 1: Thay đổi tư duy đọc tiếng Anh',
    duration: '185 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề tồn đọng của cách đọc dịch/ skimming và scanning', duration: '30 mins' },
      { num: 2, title: 'Áp dụng Linearthinking vào Reading để giải quyết những vấn đề trên', duration: '45 mins' },
      { num: 3, title: 'Áp dụng vào bài đọc thực tế', duration: '45 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Bài đọc Megafires in California', duration: '30 mins' },
      { num: 6, title: 'Bài đọc The Columbian Exchange', duration: '30 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2 — Writing 1: Thay đổi tư duy viết tiếng Anh',
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
    id: 3,
    title: 'Buổi 3 — Speaking 1: Thay đổi tư duy nói tiếng Anh',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Những vấn đề học viên thường gặp khi nói tiếng Anh + các vấn đề khi trả lời câu hỏi Part 1 IELTS', duration: '30 mins' },
      { num: 2, title: 'Cách nói một câu tiếng Anh luôn đúng + Practice', duration: '30 mins' },
      { num: 3, title: 'Cách bắt đầu một câu trả lời + Practice', duration: '30 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Listening 1: Cách làm Section 1', duration: '30 mins' },
      { num: 6, title: 'Practice lại bài Speak a correct sentence + Tập add câu Statement hay cho các câu tập ghép', duration: '45 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4 — Reading 2: Cách đọc cấu trúc câu',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Đọc cấu trúc theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Những cấu trúc câu đơn và phức thường gặp trong bài đọc', duration: '60 mins' },
      { num: 3, title: 'Áp dụng phân tích cấu trúc câu của 2 bài đọc cụ thể', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Phần True False Not Given các bài: + Coconut Palm + Alexander Henderson + Megafires', duration: '60 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5 — Writing 2: Cách cải thiện 1 câu và connect 2 câu',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách viết cấu trúc theo tư duy Linearthinking', duration: '5 mins' },
      { num: 2, title: 'Cách self-correct một câu', duration: '40 mins' },
      { num: 3, title: 'Cách cải thiện một câu', duration: '40 mins' },
      { num: 4, title: 'Cách kết nối 2 câu: with and without linking words', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Bài tập liên kết 2 câu', duration: '30 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6 — Speaking 2: Mở rộng câu trả lời Part 1',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách mở đầu câu trả lời + Cách nói 1 câu luôn đúng', duration: '5 mins' },
      { num: 2, title: 'Cách trả lời câu hỏi Part 1 dùng Linearthinking', duration: '20 mins' },
      { num: 3, title: 'Practice: Topic Math + Perfume', duration: '20 mins' },
      { num: 4, title: 'Practice: Topic Tea/Coffee', duration: '20 mins' },
      { num: 5, title: 'Practice: Handwriting + Science', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 2: Cách làm bài dạng Map/ Floor plan', duration: '30 mins' },
      { num: 8, title: 'Practice trả lời full Part 1 (đảm bảo câu Statement + expand) cho 3 topic Noises + Transportation + Photography để prepare cho bài 3', duration: '45 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7 — Reading 3: Cách trả lời câu hỏi True/ False/ Not Given',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách đọc cấu trúc câu', duration: '5 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng True/ False/ Not Given', duration: '30 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng True/ False/ Not Given', duration: '60 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc cụ thể', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Dạng Gap-fill các bài: + Coconut Palm + Alexander Henderson + Megafires', duration: '60 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8 — Writing 3: Cách áp dụng Linearthinking vào Writing Task 2',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách cải thiện 1 câu và connect 2 câu', duration: '5 mins' },
      { num: 2, title: 'Sơ lược về Writing Task 2', duration: '30 mins' },
      { num: 3, title: 'Xác định những vấn đề thường gặp trong Writing Task 2', duration: '30 mins' },
      { num: 4, title: 'Giải pháp của IELTSPro: 4 bước viết 1 bài Writing Task 2', duration: '30 mins' },
      { num: 5, title: 'Áp dụng vào dạng đề 2-part questions', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Viết full bài 2-part question trên ứng dụng của IELTSPro', duration: '60 mins' },
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
      { num: 7, title: 'Listening 3: Cách làm bài dạng Sentence Completion', duration: '30 mins' },
      { num: 8, title: 'Practice trả lời lại tất cả 6 topic từ buổi 1, đảm bảo đủ tất cả các yếu tố đã học qua 3 buổi: Statement + Expand + Coherence)', duration: '60 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10 — Reading 4: Cách trả lời câu hỏi Gapfill',
    duration: '190 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách tiếp cận dạng True False Not Given', duration: '5 mins' },
      { num: 2, title: 'Vấn đề học viên hay mắc phải trong dạng Gapfill', duration: '15 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để giải quyết dạng Gapfill', duration: '15 mins' },
      { num: 4, title: 'Cách xác định dạng từ điền vào gap', duration: '15 mins' },
      { num: 5, title: 'Cách nhận diện paraphrasing', duration: '30 mins' },
      { num: 6, title: 'Áp dụng vào bài đọc cụ thể', duration: '60 mins' },
      { num: 7, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 8, title: 'Vocab Builder 7 chủ đề', duration: '60 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11 — Writing 4: Kỹ năng Paraphrasing + Cách tiếp cận dạng Advantage/Disadvantage',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Review bài viết trên app cho cả lớp', duration: '10 mins' },
      { num: 2, title: 'Cách trả lời dạng Advantages outweigh disadvantages', duration: '30 mins' },
      { num: 3, title: 'Cách paraphrase IELTS Writing', duration: '60 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Viết full bài Advantage/Disadvantage trên ứng dụng của IELTSPro', duration: '60 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12 — Speaking 4: Introduce Part 3 + Linear Framework Part 3',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức Part 1', duration: '5 mins' },
      { num: 2, title: 'Introduce Part 3 + Show Vấn đề khi phát triển ideas cho part 3', duration: '30 mins' },
      { num: 3, title: 'Cách áp dụng Linearthinking để phát triển ideas cho part 3', duration: '30 mins' },
      { num: 4, title: 'Practice topic Books & Reading', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 4: Cách làm bài dạng Note Completion (Section 4)', duration: '30 mins' },
      { num: 7, title: 'Soạn idea + tập nói trước 4 câu hỏi khó Part 3 4 topic khác nhau', duration: '30 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13 — Reading 5: Cách học từ vựng hiệu quả',
    duration: '170 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách trả lời câu hỏi Gapfill', duration: '5 mins' },
      { num: 2, title: 'Cách học vocab 3 levels', duration: '60 mins' },
      { num: 3, title: 'Practice', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Matching Heading bài: EU Transport & Why Being Bored Is Stimulating', duration: '40 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14 — Writing 5: Cách trả lời dạng câu hỏi Discuss Both Views',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Review bài viết trên app cho cả lớp', duration: '10 mins' },
      { num: 2, title: 'Cách tiếp cận và outline cho dạng bài Discuss Both Views', duration: '40 mins' },
      { num: 3, title: 'Cách phát triển bằng công cụ Cause-Effect-Explanation', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Viết full bài Discuss Both View trên ứng dụng của IELTSPro', duration: '60 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15 — Speaking 5: Cấu trúc hoá câu trả lời Part 3',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách expand idea Part 3', duration: '5 mins' },
      { num: 2, title: 'Vấn đề khi đảm bảo Coherence cho part 3 + Cách cấu trúc hoá câu trả lời', duration: '20 mins' },
      { num: 3, title: 'Practice dạng câu hỏi Listing', duration: '30 mins' },
      { num: 4, title: 'Practice dạng câu hỏi Yes/No', duration: '30 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Listening 5: Cách làm bài dạng Matching', duration: '30 mins' },
      { num: 7, title: 'Practice Part 3 topic Fame + Money', duration: '60 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16 — Reading 6: Cách đọc connection và cách làm dạng bài Matching Heading',
    duration: '140 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách học từ vựng hiệu quả', duration: '5 mins' },
      { num: 2, title: 'Vấn đề với cách tiếp cận cũ với dạng Matching Heading', duration: '20 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Matching Heading', duration: '20 mins' },
      { num: 4, title: 'Cách đọc connection giữa 2 câu', duration: '30 mins' },
      { num: 5, title: 'Áp dụng vào bài đọc', duration: '40 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Matching Heading Dawn of The Robots', duration: '20 mins' },
    ],
  },
  {
    id: 17,
    title: 'Buổi 17 — Writing 6: Cách trả lời dạng câu hỏi Agree/ Disagree',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Review bài viết trên app cho cả lớp', duration: '10 mins' },
      { num: 2, title: 'Cách tiếp cận và outline cho dạng bài Agree/ Disagree', duration: '40 mins' },
      { num: 3, title: 'Cách phát triển idea bằng công cụ Examples', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào đề bài cụ thể', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Viết full bài Agree/ Disagree trên ứng dụng của IELTSPro', duration: '60 mins' },
    ],
  },
  {
    id: 18,
    title: 'Buổi 18 — Speaking 6: Luyện tập trả lời câu hỏi Part 3',
    duration: '125 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách áp dụng Linearthinking để phát triển ideas trong part 3', duration: '15 mins' },
      { num: 2, title: 'Áp dụng vào đề thi Part 3 thật', duration: '90 mins' },
      { num: 3, title: 'Tổng hợp những lỗi thường gặp khi trả lời câu hỏi Part 3', duration: '15 mins' },
      { num: 4, title: 'Giao homework', duration: '5 mins' },
    ],
  },
  {
    id: 19,
    title: 'Buổi 19 — Reading 7: Luyện tập cách đọc connection để làm Matching Heading',
    duration: '165 mins',
    lessons: [
      { num: 1, title: 'Ôn tập cách đọc connection', duration: '5 mins' },
      { num: 2, title: 'Luyện tập: Xác định loại mối quan hệ giữa hai câu', duration: '40 mins' },
      { num: 3, title: 'Luyện tập: Tóm tắt nội dung 2 câu', duration: '40 mins' },
      { num: 4, title: 'Luyện tập: Áp dụng đọc connection để làm Matching Heading', duration: '40 mins' },
      { num: 5, title: 'Matching Names Làm bài Dawn of the Robots & Multiple Choice Làm bài Neuroaesthetics', duration: '40 mins' },
    ],
  },
  {
    id: 20,
    title: 'Buổi 20 — Writing 7: Linearthinking trong Writing Task 1',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Các dạng bài trong Task 2', duration: '5 mins' },
      { num: 2, title: 'Cách chọn thông tin cho Overview và Body theo Linearthinking', duration: '60 mins' },
      { num: 3, title: 'Luyện tập', duration: '60 mins' },
      { num: 4, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 5, title: 'Bài tập ứng dụng tư duy Linearthinking để chọn số liệu', duration: '20 mins' },
    ],
  },
  {
    id: 21,
    title: 'Buổi 21 — Speaking 7: Introduce + Cách tiếp cận bài Part 2 + Dạng đề People',
    duration: '195 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Tổng hợp kiến thức cho Part 3', duration: '5 mins' },
      { num: 2, title: 'Introduce Part 2 + Show các vấn đề mở rộng 1 bài nói Part 2', duration: '15 mins' },
      { num: 3, title: 'Cách trả lời 3 câu hỏi gợi ý + Practice', duration: '30 mins' },
      { num: 4, title: 'Cách trả lời câu hỏi “Why…” + Practice', duration: '30 mins' },
      { num: 5, title: 'Practice full bài Part 2 dạng People', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 7: Cách làm bài dạng Matching', duration: '30 mins' },
      { num: 8, title: 'Practice thêm 3 đề Part 2 dạng đề People', duration: '60 mins' },
    ],
  },
  {
    id: 22,
    title: 'Buổi 22 — Reading 8: Cách làm dạng bài Multiple Choice và Matching names',
    duration: '150 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Matching Heading', duration: '5 mins' },
      { num: 2, title: 'Cách IELTSPro tiếp cận dạng Matching names', duration: '30 mins' },
      { num: 3, title: 'Vấn đề với cách tiếp cận cũ với dạng Multiple Choice', duration: '30 mins' },
      { num: 4, title: 'Cách IELTSPro tiếp cận dạng Multiple Choice', duration: '30 mins' },
      { num: 5, title: 'Áp dụng vào bài đọc', duration: '30 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Last Man Standing (full bài)', duration: '20 mins' },
    ],
  },
  {
    id: 23,
    title: 'Buổi 23 — Writing 8: Cách miêu tả số liệu trong Writing Task 1 và cấu trúc so sánh trong Writing Task 1',
    duration: '160 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Linearthinking trong Task 1', duration: '5 mins' },
      { num: 2, title: 'Cách miêu tả số liệu trong Task 1', duration: '40 mins' },
      { num: 3, title: 'Cấu trúc câu so sánh trong Writing Task 1', duration: '40 mins' },
      { num: 4, title: 'Áp dụng vào bài Task 1', duration: '40 mins' },
      { num: 5, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 6, title: 'Bài tập viết câu đưa số liệu và so sánh dựa vào biểu đồ đã cho', duration: '30 mins' },
    ],
  },
  {
    id: 24,
    title: 'Buổi 24 — Speaking 8: Cách take note hiệu quả cho Part 2 + Dạng đề Object',
    duration: '220 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách tiếp cận bài Part 2 + Dạng đề People', duration: '5 mins' },
      { num: 2, title: 'Áp dụng cách approach cho dạng đề Object + Practice', duration: '30 mins' },
      { num: 3, title: 'Cách take note hiệu quả cho Part 2', duration: '20 mins' },
      { num: 4, title: 'Practice dạng đề Object', duration: '20 mins' },
      { num: 5, title: 'Practice dạng đề People', duration: '20 mins' },
      { num: 6, title: 'Tóm tắt nội dung bài học', duration: '5 mins' },
      { num: 7, title: 'Listening 8: Cách làm bài dạng Multiple Choice', duration: '30 mins' },
      { num: 8, title: 'Chuẩn bị 4 đề Part 2 (2 đề People + 2 đề Object)', duration: '90 mins' },
    ],
  },
  {
    id: 25,
    title: 'Buổi 25 — Reading 9: Cách làm dạng Matching Endings và Matching Information',
    duration: '100 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách làm dạng bài Matching names và Multiple Choice', duration: '5 mins' },
      { num: 2, title: 'Cách IELTSPro tiếp cận dạng Matching Endings', duration: '15 mins' },
      { num: 3, title: 'Cách IELTSPro tiếp cận dạng Matching information', duration: '30 mins' },
      { num: 4, title: 'Áp dụng vào bài đọc', duration: '45 mins' },
      { num: 5, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
    ],
  },
  {
    id: 26,
    title: 'Buổi 26 — Writing 9: Trend Language + Cách viết bài Task 1 hoàn chỉnh',
    duration: '255 mins',
    lessons: [
      { num: 1, title: 'Ôn tập: Cách so sánh trong Task 1', duration: '10 mins' },
      { num: 2, title: 'Cách sử dụng Language of trend (ngôn ngữ tăng giảm) trong Task 1', duration: '60 mins' },
      { num: 3, title: 'Cách viết mở bài', duration: '20 mins' },
      { num: 4, title: 'Dùng từ liên kết', duration: '10 mins' },
      { num: 5, title: 'Viết 1 bài Task 1 hoàn chỉnh', duration: '30 mins' },
      { num: 6, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 7, title: 'Viết 3 bài Task 1 hoàn chỉnh trên ứng dụng của IELTSPro', duration: '120 mins' },
    ],
  },
  {
    id: 27,
    title: 'Buổi 27 — Speaking 9: Revision toàn khóa + Extra Practice Part 2 + Dạng đề Place',
    duration: '110 mins',
    lessons: [
      { num: 1, title: 'Revision các điểm quan trọng của Part 1 + 3', duration: '5 mins' },
      { num: 2, title: 'Áp dụng approach cho dạng đề Place + Practice', duration: '30 mins' },
      { num: 3, title: 'Practice Part 2 các đề topic People + Object + Place', duration: '60 mins' },
      { num: 4, title: 'Nhận xét sự tiến bộ sau khoá', duration: '5 mins' },
      { num: 5, title: 'Listening 9: ôn tập', duration: '10 mins' },
    ],
  },
]

const ielts65Teachers = {
  1: {
    name: 'Thầy Nguyễn Bá Thọ',
    titleName: 'Thầy Nguyễn Bá Thọ',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      'Thạc sĩ (Đại học Monpelier - Pháp)',
      '8.5 IELTS Overall',
      'Cựu giảng viên (ĐH Y Dược TPHCM)',
      '8.5 IELTS Writing',
      'Khách mời Main Show (The IELTS Face-off mùa 4)',
    ],
    quote: 'Để làm tròn được bổn phận của 1 người thầy thì cái tâm thôi là chưa đủ. Giáo viên sẽ cần phải luôn luôn tìm tòi, làm sao để tạo ra trải nghiệm tốt nhất cho học sinh của mình.',
  },
  2: {
    name: 'Cô Đặng Lê Phương Uyên',
    titleName: 'Cô Đặng Lê Phương Uyên',
    titlePrefix: 'Cô',
    quoteLabel: 'CÔ',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '8.5 IELTS Writing',
      '8.5 IELTS Overall',
    ],
    quote: 'Trong việc giảng dạy, mình luôn đến lớp với mong muốn mang đến đa dạng cách tiếp cận cũng như góc nhìn mới mẻ hơn đối với việc học ngôn ngữ cho các bạn học sinh Việt Nam',
  },
}

export default function Ielts65() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa IELTS 6.5 | IELTSPro'
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
            <span className="current">IELTS 6.5</span>
          </nav>

          {/* 2-Column Grid Layout */}
          <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (lg:col-span-2) */}
            <main className="cd-main lg:col-span-2">
              <HeroSection
                title="Khóa IELTS 6.5"
                rating="5.0/5"
                reviews="10,000 review"
                teachers={ielts65Teachers}
                description="IELTS 6.5 là khóa học dành cho những bạn muốn bứt phá bằng chiến lược thay vì học lan man. Phương pháp Linearthinking giúp bạn tối ưu nền tảng sẵn có, tập trung vào những tiêu chí quan trọng nhất của bài thi, nâng cao hiệu quả ở cả 4 kỹ năng và tiến gần hơn đến mục tiêu 6.5 IELTS."
                inputBand="IELTS 5.5"
                outputBand="IELTS 6.5"
              />
              <BenefitsSection outcomes={ielts65Outcomes} />
              <CurriculumSection
                title="Chương trình học 9 tuần"
                headerMeta="27 Buổi · 172 Bài học · 54h học tập"
                sessions={ielts65Sessions}
                unit="buổi"
              />
              <TeachersSection teachers={ielts65Teachers} />
              <CourseScheduleTable title="Lịch học Khóa IELTS 6.5" scheduleData={schedulesData65} />
            </main>

            {/* Right Column (lg:col-span-1) */}
            <SidebarOffer />
          </div>
        </div>
      </div>
    </>
  )
}
