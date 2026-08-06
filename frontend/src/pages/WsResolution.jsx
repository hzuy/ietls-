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

const wsSchedules = [
  { id: 1, startDate: '08/08/2026', courseName: 'Khóa Writing Speaking', status: 'Gần hết chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 10', address: 'Hẻm 458/14, 3 Tháng 2, P12, Q.10, TP.HCM' },
  { id: 2, startDate: '04/08/2026', courseName: 'Khóa Writing Speaking', status: 'Gần hết chỗ', schedule: 'Thứ 3/5', time: '18:00 - 21:00', location: 'Online', address: 'Học Trực tuyến qua LMS & Zoom' },
  { id: 3, startDate: '26/07/2026', courseName: 'Khóa Writing Speaking', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Bình Thạnh D3', address: '24/1 Võ Oanh (D3), Bình Thạnh, P.25, TP.HCM' },
  { id: 4, startDate: '02/08/2026', courseName: 'Khóa Writing Speaking', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Tân Bình', address: '24A Bàu Cát 2, Tân Bình, P.14, TP.HCM' },
  { id: 5, startDate: '02/08/2026', courseName: 'Khóa Writing Speaking', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '09:00 - 12:00', location: 'Quận 7', address: '456 Nguyễn Thị Thập, P.Tân Quy, Q.7, TP.HCM' },
  { id: 6, startDate: '08/08/2026', courseName: 'Khóa Writing Speaking', status: 'Còn chỗ', schedule: 'Thứ 7/CN', time: '13:30 - 16:30', location: 'Quận 6', address: '61-63 Bà Hom, P.13, Q.6, TP.HCM' },
]

const wsOutcomes = [
  'Hiểu rõ cấu trúc bài thi IELTS Writing & Speaking cũng như cách tiếp cận bài thi IELTS',
  'Hình thành tư duy học tiếng Anh đúng.',
  'Bỏ hoàn toàn tư duy đọc dịch, viết dịch, nói dịch.',
  'Có khả năng diễn đạt và phát triển ý tưởng của mình một cách nhanh chóng và lưu loát',
  'Tích lũy vốn từ vựng và ngữ pháp cao cấp tự nhiên và có thể áp dụng thuần thục trong Writing & Speaking',
]

const wsSessions = [
  {
    id: 1,
    title: 'Buổi 1: How to Frame your essay using Linearthinking',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Marking criteria', duration: '60 mins' },
      { num: 2, title: 'Common errors in logical thinking', duration: '30 mins' },
      { num: 3, title: 'Linearthinking: Framework 123813', duration: '30 mins' },
      { num: 4, title: 'Practice', duration: '60 mins' },
      { num: 5, title: 'Write outlines for IELTS Task 2 questions', duration: '30 mins' },
    ],
  },
  {
    id: 2,
    title: 'Buổi 2: How to generate and develop ideas using Linearthinking',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Common problems in generating ideas: Analysing sample essays', duration: '30 mins' },
      { num: 2, title: 'How to generate ideas using Linearthinking', duration: '30 mins' },
      { num: 3, title: 'Common problems in developing ideas: Analysing sample essays', duration: '30 mins' },
      { num: 4, title: 'How to develop ideas using Linearthinking', duration: '30 mins' },
      { num: 5, title: 'Practice', duration: '60 mins' },
      { num: 6, title: 'Develop ideas for IELTS Task 2 questions', duration: '30 mins' },
      { num: 7, title: 'Read articles to prepare for Lesson 3', duration: '30 mins' },
    ],
  },
  {
    id: 3,
    title: 'Buổi 3: Urban Living',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '30 mins' },
      { num: 2, title: 'Advantages of Urban and Rural Life', duration: '45 mins' },
      { num: 3, title: 'Problems associated with Urban life', duration: '45 mins' },
      { num: 4, title: 'Application in real-test questions', duration: '60 mins' },
      { num: 5, title: 'Read articles to prepare for Lesson 4', duration: '30 mins' },
      { num: 6, title: 'Write a Task 2 essay', duration: '30 mins' },
    ],
  },
  {
    id: 4,
    title: 'Buổi 4: Advertising',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '30 mins' },
      { num: 2, title: 'Different forms of advertising', duration: '30 mins' },
      { num: 3, title: 'Positive effects of advertising', duration: '30 mins' },
      { num: 4, title: 'Effectiveness of advertising', duration: '30 mins' },
      { num: 5, title: 'Application in real-test questions', duration: '60 mins' },
      { num: 6, title: 'Read articles to prepare for Lesson 5', duration: '30 mins' },
      { num: 7, title: 'Write a Task 2 essay', duration: '30 mins' },
    ],
  },
  {
    id: 5,
    title: 'Buổi 5: Government and Public Policy',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '20 mins' },
      { num: 2, title: 'Government responsibilities: Housing', duration: '20 mins' },
      { num: 3, title: 'Government responsibilities: Healthcare', duration: '20 mins' },
      { num: 4, title: 'Government responsibilities: Education', duration: '20 mins' },
      { num: 5, title: 'Government responsibilities: Finance', duration: '20 mins' },
      { num: 6, title: 'Government responsibilities: Arts and Science', duration: '20 mins' },
      { num: 7, title: 'Practice', duration: '60 mins' },
      { num: 8, title: 'Read articles to prepare for Lesson 6', duration: '30 mins' },
      { num: 9, title: 'Write a Task 2 essay', duration: '30 mins' },
    ],
  },
  {
    id: 6,
    title: 'Buổi 6: Crimes/ Legal system',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '30 mins' },
      { num: 2, title: 'Description of the legal system', duration: '20 mins' },
      { num: 3, title: 'Types of crimes', duration: '20 mins' },
      { num: 4, title: 'Reasons behind crimes', duration: '20 mins' },
      { num: 5, title: 'Solutions to reduce crime rate', duration: '30 mins' },
      { num: 6, title: 'Practice', duration: '60 mins' },
      { num: 7, title: 'Read articles to prepare for Lesson 7', duration: '30 mins' },
      { num: 8, title: 'Write a Task 2 essay', duration: '30 mins' },
    ],
  },
  {
    id: 7,
    title: 'Buổi 7: Environment',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '20 mins' },
      { num: 2, title: 'Environmental protection: Whose responsibilities is it?', duration: '20 mins' },
      { num: 3, title: 'Reasons to protect the environment', duration: '20 mins' },
      { num: 4, title: 'Common environmental problems', duration: '20 mins' },
      { num: 5, title: 'Causes behind environmental problems', duration: '20 mins' },
      { num: 6, title: 'Solutions for environmental problems', duration: '20 mins' },
      { num: 7, title: 'Practice', duration: '60 mins' },
      { num: 8, title: 'Read articles to prepare for Lesson 8', duration: '30 mins' },
      { num: 9, title: 'Write a Task 2 essay', duration: '30 mins' },
    ],
  },
  {
    id: 8,
    title: 'Buổi 8: Business',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Lead-in Activity', duration: '30 mins' },
      { num: 2, title: 'What responsibilities businesses should have', duration: '20 mins' },
      { num: 3, title: 'Why should businesses take responsibilities', duration: '20 mins' },
      { num: 4, title: 'Who should run these businesses', duration: '20 mins' },
      { num: 5, title: 'What skills are needed in these people', duration: '30 mins' },
      { num: 6, title: 'Practice', duration: '60 mins' },
      { num: 7, title: 'Write 2 Task 2 essays', duration: '30 mins' },
    ],
  },
  {
    id: 9,
    title: 'Buổi 9: Linearthinking in Speaking',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Ice-breaking activity', duration: '15 mins' },
      { num: 2, title: 'Common problems in IELTS Speaking', duration: '15 mins' },
      { num: 3, title: 'Linearthinking: Speak in structure', duration: '40 mins' },
      { num: 4, title: 'Linearthinking: Think in English', duration: '40 mins' },
      { num: 5, title: 'Linearthinking: Linear tools', duration: '40 mins' },
      { num: 6, title: 'Practice', duration: '30 mins' },
      { num: 7, title: 'Answer difficult IELTS Speaking questions for part 1,2,3', duration: '30 mins' },
    ],
  },
  {
    id: 10,
    title: 'Buổi 10: Functional language for 3 parts',
    duration: '240 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '30 mins' },
      { num: 2, title: 'Language for Part 1', duration: '40 mins' },
      { num: 3, title: 'Language for Part 2', duration: '40 mins' },
      { num: 4, title: 'Language for Part 3', duration: '40 mins' },
      { num: 5, title: 'Practice', duration: '30 mins' },
      { num: 6, title: 'Answer IELTS Speaking questions for Part 1,2,3', duration: '30 mins' },
      { num: 7, title: 'Watch videos/ listen to audios to prepare for Lesson 3', duration: '30 mins' },
    ],
  },
  {
    id: 11,
    title: 'Buổi 11: Urban Living',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Watch videos/ listen to audios to prepare for Lesson 4', duration: '30 mins' },
    ],
  },
  {
    id: 12,
    title: 'Buổi 12: Advertising',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Watch videos/ listen to audios to prepare for Lesson 5', duration: '30 mins' },
    ],
  },
  {
    id: 13,
    title: 'Buổi 13: Government and Public Policy',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Watch videos/ listen to audios to prepare for Lesson 7', duration: '30 mins' },
    ],
  },
  {
    id: 14,
    title: 'Buổi 14: Crimes/ Legal system',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Watch videos/ listen to audios to prepare for Lesson 8', duration: '30 mins' },
    ],
  },
  {
    id: 15,
    title: 'Buổi 15: Environment',
    duration: '210 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
      { num: 5, title: 'Answer questions for IELTS Speaking Part 1,2,3', duration: '30 mins' },
    ],
  },
  {
    id: 16,
    title: 'Buổi 16: Business',
    duration: '180 mins',
    lessons: [
      { num: 1, title: 'Revision', duration: '20 mins' },
      { num: 2, title: 'Ideas and vocab', duration: '40 mins' },
      { num: 3, title: 'Application in 3 parts', duration: '90 mins' },
      { num: 4, title: 'Practice', duration: '30 mins' },
    ],
  },
]

const wsTeachers = {
  1: {
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
  2: {
    name: 'Thầy Trần Thiện Minh',
    titleName: 'Thầy Trần Thiện Minh',
    titlePrefix: 'Thầy',
    quoteLabel: 'THẦY',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    features: [
      'Linearthinking Ambassador (Sứ giả Linearthinking IeltsPro)',
      '9.0 IELTS Overall',
      '8.5 IELTS Writing',
      '2310/2400 SAT',
      'Cử nhân (RMIT University)',
      'TEFL (Chứng chỉ nghiệp vụ sư phạm quốc tế)',
    ],
    quote: 'I believe in the empowerment of student. In my class, I strive not to be a "lecturer," but rather a facilitator of learning.',
  },
}

export default function WsResolution() {
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'Khóa Writing Speaking | IELTSPro'
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
            <span className="current">Writing Speaking</span>
          </nav>

          {/* 2-Column Grid Layout */}
          <div className="cd-layout grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column (lg:col-span-2) */}
            <main className="cd-main lg:col-span-2">
              <HeroSection
                title="Khóa Writing Speaking"
                rating="5.0/5"
                reviews="10,000 review"
                teachers={wsTeachers}
                description='Đề khó, đề lạ không còn là rào cản. Khoá IELTS 7.0 với phương pháp Linearthinking giúp bạn tăng tốc độ đọc hiểu, "chấp mọi đề" bằng tư duy phát triển ý logic, nâng cao Writing và Speaking thông qua việc hiểu bản chất tiêu chí chấm điểm thay vì học thuộc mẫu hay ghi nhớ máy móc.'
                inputBand="Hoàn thành IELTS 7.0"
                outputBand="Nâng cấp Writing & Speaking"
              />
              <BenefitsSection outcomes={wsOutcomes} />
              <CurriculumSection
                title="Chương trình học 8 tuần"
                headerMeta="16 Buổi · 101 Bài học · 48h học tập"
                sessions={wsSessions}
                unit="buổi"
              />
              <TeachersSection teachers={wsTeachers} />
              <CourseScheduleTable title="Lịch học Khóa Writing Speaking" scheduleData={wsSchedules} />
            </main>

            {/* Right Column (lg:col-span-1) */}
            <SidebarOffer />
          </div>
        </div>
      </div>
    </>
  )
}
