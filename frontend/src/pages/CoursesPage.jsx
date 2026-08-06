import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import '../styles/coursesPage.css'

import HeroStats from '../components/courses/HeroStats'
import SkillsSection from '../components/courses/SkillsSection'
import PainSolutionSection from '../components/courses/PainSolutionSection'
import RoadmapSection from '../components/courses/RoadmapSection'
import TestimonialsSection from '../components/courses/TestimonialsSection'
import FaqSection from '../components/courses/FaqSection'

export default function CoursesPage() {
  useEffect(() => {
    document.title = 'Khóa học IELTS | IELTSPro'
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Navbar />
      <div className="courses-page-wrapper">
        <HeroStats />
        <SkillsSection />
        <PainSolutionSection />
        <RoadmapSection />
        <TestimonialsSection />
        <FaqSection />
      </div>
    </>
  )
}
