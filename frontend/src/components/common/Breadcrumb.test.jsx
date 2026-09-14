import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Breadcrumb from './Breadcrumb'

describe('Breadcrumb', () => {
  it('returns null when items is empty or undefined', () => {
    const { container } = render(<Breadcrumb items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders breadcrumb items correctly with links and active page', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Phòng thi chuẩn hóa', to: '/full-test' },
            { label: 'IELTS Cambridge Academic' }
          ]}
        />
      </MemoryRouter>
    )

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()

    const homeLink = screen.getByRole('link', { name: 'Trang chủ' })
    expect(homeLink).toHaveAttribute('href', '/')

    const fullTestLink = screen.getByRole('link', { name: 'Phòng thi chuẩn hóa' })
    expect(fullTestLink).toHaveAttribute('href', '/full-test')

    const activeItem = screen.getByText('IELTS Cambridge Academic')
    expect(activeItem).toHaveAttribute('aria-current', 'page')
  })
})
