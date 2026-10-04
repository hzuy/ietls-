import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import * as authContext from './context/AuthContext'
import { LearnerRoute, RoleRoute } from './App'
import { ADMIN_PAGE_ROLES } from './utils/roles'

function renderAt(path, role, element) {
  if (role) localStorage.setItem('token', 'fake-token')
  vi.spyOn(authContext, 'useAuth').mockReturnValue({ role: role || 'user' })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>Trang người học</div>} />
        <Route path="/admin" element={<div>Bảng điều khiển staff</div>} />
        <Route path={path.split('?')[0]} element={element} />
      </Routes>
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('LearnerRoute — learner pages are only for learner accounts', () => {
  it.each(['admin', 'teacher'])('sends a logged-in %s back to /admin', role => {
    renderAt('/progress', role, <LearnerRoute><div>Trang tiến độ</div></LearnerRoute>)
    expect(screen.getByText('Bảng điều khiển staff')).toBeInTheDocument()
    expect(screen.queryByText('Trang tiến độ')).not.toBeInTheDocument()
  })

  it('lets a learner in', () => {
    renderAt('/progress', 'user', <LearnerRoute><div>Trang tiến độ</div></LearnerRoute>)
    expect(screen.getByText('Trang tiến độ')).toBeInTheDocument()
  })

  it('still lets staff open an exam in preview mode', () => {
    renderAt('/reading/5?preview=true', 'admin', <LearnerRoute><div>Xem trước đề</div></LearnerRoute>)
    expect(screen.getByText('Xem trước đề')).toBeInTheDocument()
  })

  it('public learner pages stay open to guests', () => {
    renderAt('/writing-samples', null, <LearnerRoute allowGuest><div>Bài mẫu</div></LearnerRoute>)
    expect(screen.getByText('Bài mẫu')).toBeInTheDocument()
  })
})

describe('RoleRoute — admin pages follow the menu shown for each role', () => {
  const page = (path, label) => <RoleRoute roles={ADMIN_PAGE_ROLES[path]}><div>{label}</div></RoleRoute>

  it('admin cannot open teacher-only Practice/Samples pages', () => {
    renderAt('/admin/reading-practice', 'admin', page('/admin/reading-practice', 'Reading Practice'))
    expect(screen.getByText('Bảng điều khiển staff')).toBeInTheDocument()
    expect(screen.queryByText('Reading Practice')).not.toBeInTheDocument()
  })

  it('teacher can open teacher-only pages', () => {
    renderAt('/admin/writing-samples', 'teacher', page('/admin/writing-samples', 'Writing Samples'))
    expect(screen.getByText('Writing Samples')).toBeInTheDocument()
  })

  it('teacher cannot open admin-only pages', () => {
    renderAt('/admin/users', 'teacher', page('/admin/users', 'Người dùng'))
    expect(screen.getByText('Bảng điều khiển staff')).toBeInTheDocument()
  })

  it('learner cannot open any staff page', () => {
    renderAt('/admin/attempts', 'user', page('/admin/attempts', 'Lịch sử thi'))
    expect(screen.getByText('Trang người học')).toBeInTheDocument()
  })

  it('every admin page is reachable by at least one staff role and never by learners', () => {
    for (const roles of Object.values(ADMIN_PAGE_ROLES)) {
      expect(roles.length).toBeGreaterThan(0)
      expect(roles).not.toContain('user')
    }
  })
})
