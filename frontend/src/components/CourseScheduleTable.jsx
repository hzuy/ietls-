import { useState, useEffect } from 'react'
import { Calendar, Users, Clock, MapPin } from 'lucide-react'

export default function CourseScheduleTable({ title = 'Lịch học Khóa IELTS', scheduleData = [] }) {
  const [locationFilter, setLocationFilter] = useState('Tất cả')
  const [showAllSchedules, setShowAllSchedules] = useState(false)

  useEffect(() => {
    setShowAllSchedules(false)
  }, [locationFilter])

  const getLocation = (s) => s.filterValue || s.location || s.locationShort

  const filterOptions = Array.from(new Set(scheduleData.map(getLocation))).filter(Boolean).sort()

  const filteredList = locationFilter === 'Tất cả'
    ? scheduleData
    : scheduleData.filter(s => getLocation(s) === locationFilter)

  const displayedSchedules = locationFilter === 'Tất cả' && !showAllSchedules
    ? filteredList.slice(0, 5)
    : filteredList

  const showScheduleBtn = locationFilter === 'Tất cả' && scheduleData.length > 5

  return (
    <section id="schedule-section">
      <div className="cd-schedule-header">
        <h2 className="cd-section-title" style={{ marginBottom: 0 }}>{title}</h2>
        <div>
          <span style={{ fontSize: '14px', fontWeight: 500, marginRight: '8px' }}>Nơi học:</span>
          <select 
            className="cd-schedule-select" 
            value={locationFilter} 
            onChange={e => setLocationFilter(e.target.value)}
          >
            <option value="Tất cả">Tất cả ▼</option>
            {filterOptions.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="cd-schedule-table-wrap">
        <table className="cd-schedule-table">
          <thead>
            <tr>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-500 stroke-[1.75]" /> LỚP KHAI GIẢNG
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500 stroke-[1.75]" /> SỐ LƯỢNG HV
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500 stroke-[1.75]" /> BUỔI HỌC
                </span>
              </th>
              <th>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-500 stroke-[1.75]" /> HỌC TẠI
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedSchedules.map((sch, idx) => {
              const dateVal = sch.date || sch.startDate
              const courseVal = sch.course || sch.courseName || title.replace(/^Lịch học\s+/, '')
              const statusVal = sch.status || 'Còn chỗ'
              const daysVal = sch.days || sch.schedule
              const timeVal = sch.time
              const locShortVal = sch.locationShort || sch.location
              const locFullVal = sch.locationFull || sch.address
              const statusUpper = statusVal.toUpperCase()
              const isFull = statusUpper === 'HẾT CHỖ'
              const isAvailable = statusUpper === 'CÒN CHỖ'
              const isAlmost = statusUpper === 'GẦN HẾT CHỖ'

              return (
                <tr key={sch.id || idx} className={isFull ? 'full-row' : ''}>
                  <td>
                    <div className="cd-sch-date">{dateVal}</div>
                    <div className="cd-sch-course">/ {courseVal}</div>
                  </td>
                  <td>
                    <div className={`cd-status-badge ${isAvailable ? 'available' : isAlmost ? 'almost' : 'full'}`}>
                      {statusUpper}
                    </div>
                  </td>
                  <td>
                    <div className="cd-sch-bold">{daysVal}</div>
                    <div className="cd-sch-sub">{timeVal}</div>
                  </td>
                  <td>
                    <div className="cd-sch-bold">{locShortVal}</div>
                    {locFullVal && <div className="cd-sch-sub">/ {locFullVal}</div>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showScheduleBtn && (
        <button 
          className="cd-btn-more" 
          style={{ marginTop: '24px' }}
          onClick={() => setShowAllSchedules(!showAllSchedules)}
        >
          {showAllSchedules ? 'Thu gọn ▲' : `Hiện thêm lớp (${scheduleData.length - 5}) ▼`}
        </button>
      )}
    </section>
  )
}
