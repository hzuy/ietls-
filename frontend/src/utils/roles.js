export const STAFF_ROLES = ['admin', 'teacher']

export const isStaff = role => STAFF_ROLES.includes(role)

export const homePathFor = role => (isStaff(role) ? '/admin' : '/')

export const ADMIN_PAGE_ROLES = {
  '/admin': ['admin', 'teacher'],
  '/admin/users': ['admin'],
  '/admin/accounts': ['admin'],
  '/admin/exams': ['admin', 'teacher'],
  '/admin/reading-practice': ['teacher'],
  '/admin/listening-practice': ['teacher'],
  '/admin/writing-samples': ['teacher'],
  '/admin/speaking-samples': ['teacher'],
  '/admin/attempts': ['admin', 'teacher'],
  '/admin/audit-logs': ['admin'],
  '/admin/trash': ['admin', 'teacher'],
  '/admin/profile': ['admin', 'teacher'],
}
