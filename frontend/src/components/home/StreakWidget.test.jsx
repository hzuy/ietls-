import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StreakWidget from './StreakWidget'

describe('StreakWidget — Heatmap & Day Streak Banner', () => {
  it('renders streak counter, "Day streak" text and VN note when authenticated', () => {
    render(<StreakWidget streak={7} isAuthenticated={true} freezeCount={0} />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Day streak')).toBeInTheDocument()
    expect(screen.getByText('*Streak ngày mới bắt đầu lúc 0h giờ VN')).toBeInTheDocument()
  })

  it('renders 0 for streak when unauthenticated', () => {
    render(<StreakWidget streak={5} isAuthenticated={false} freezeCount={0} />)

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('Day streak')).toBeInTheDocument()
  })

  it('renders the day axis labels (Tue, Thu, Sat) and legend items', () => {
    render(<StreakWidget streak={1} isAuthenticated={true} />)

    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()

    expect(screen.getByText('Ít')).toBeInTheDocument()
    expect(screen.getByText('Nhiều')).toBeInTheDocument()
  })

  it('shows tooltip with practice count on hover, and "Lười quá..." when count is 0', () => {
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    
    // Ngày hôm qua
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    const activityMap = {
      [yesterdayKey]: 25,
    }

    render(<StreakWidget streak={0} isAuthenticated={true} freezeCount={0} activityMap={activityMap} />)

    const yesterdayCell = screen.getByTestId(`heatmap-cell-${yesterdayKey}`)
    const todayCell = screen.getByTestId(`heatmap-cell-${todayKey}`)

    // Hover ngày hôm qua (có 25 lần)
    fireEvent.mouseEnter(yesterdayCell)
    expect(screen.getByText(`Luyện 25 lần vào ngày ${yesterday.getDate()}/${yesterday.getMonth() + 1}`)).toBeInTheDocument()

    // Hover ngày hôm nay (0 lần)
    fireEvent.mouseEnter(todayCell)
    expect(screen.getByText(`Lười quá, không luyện vào ngày ${today.getDate()}/${today.getMonth() + 1}`)).toBeInTheDocument()

    // Mouse leave
    fireEvent.mouseLeave(todayCell)
    expect(screen.queryByTestId('heatmap-tooltip')).not.toBeInTheDocument()
  })
})
