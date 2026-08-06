import CourseScheduleTable from '../CourseScheduleTable'

export default function ScheduleSection({ schedules, courseTitle = 'Khóa IELTS 4.0' }) {
  return <CourseScheduleTable title={`Lịch học ${courseTitle}`} scheduleData={schedules} />
}
