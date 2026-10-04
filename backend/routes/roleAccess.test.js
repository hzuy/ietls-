import { describe, it, expect } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test_secret_key'

const anyModel = new Proxy({}, {
  get: () => async () => null,
})
const prismaMock = new Proxy({}, {
  get: (_, key) => (key === '$transaction' ? async ops => (Array.isArray(ops) ? [] : ops(prismaMock)) : anyModel),
})
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const serverPath = require.resolve('../server')
delete require.cache[serverPath]
const app = require('../server')

const token = role => jwt.sign({ userId: 7, email: `${role}@example.com`, role }, process.env.JWT_SECRET)

const LEARNER_ONLY = [
  ['post', '/api/reading/exams/1/submit'],
  ['get', '/api/reading/exams/1/result-detail'],
  ['post', '/api/listening/exams/1/submit'],
  ['get', '/api/listening/exams/1/result-detail'],
  ['get', '/api/writing/exams/1/my-results'],
  ['post', '/api/writing/exams/1/submit'],
  ['get', '/api/writing/answers/1/status'],
  ['post', '/api/writing/answers/1/retry'],
  ['get', '/api/speaking/exams/1/my-results'],
  ['post', '/api/speaking/transcribe'],
  ['post', '/api/speaking/exams/1/submit'],
  ['get', '/api/speaking/answers/1/status'],
  ['post', '/api/speaking/answers/1/retry'],
  ['get', '/api/user/stats'],
  ['get', '/api/user/history'],
  ['get', '/api/full-test/status'],
  ['get', '/api/full-test/result'],
  ['get', '/api/full-test/user-progress'],
  ['get', '/api/stats/error-breakdown'],
  ['get', '/api/stats/trend'],
  ['get', '/api/stats/writing-criteria'],
  ['get', '/api/stats/speaking-criteria'],
  ['post', '/api/stats/advice'],
  ['post', '/api/chatbot/chat'],
]

const TEACHER_ONLY = [
  ['get', '/api/practice/admin/reading'],
  ['get', '/api/practice/admin/listening'],
  ['get', '/api/practice/admin/reading/1'],
  ['post', '/api/practice/admin/reading'],
  ['put', '/api/practice/admin/reading/1'],
  ['delete', '/api/practice/admin/reading/1'],
  ['get', '/api/samples/admin/writing'],
  ['get', '/api/samples/admin/speaking/1'],
  ['post', '/api/samples/admin/writing'],
  ['put', '/api/samples/admin/speaking/1'],
  ['delete', '/api/samples/admin/writing/1'],
]

const ADMIN_ONLY = [
  ['get', '/api/admin/users'],
  ['get', '/api/admin/staff'],
  ['post', '/api/admin/accounts'],
  ['get', '/api/admin/audit-logs'],
  ['get', '/api/admin/settings'],
  ['post', '/api/admin/make-admin'],
]

const STAFF = [
  ['get', '/api/admin/dashboard'],
  ['get', '/api/admin/exams'],
  ['get', '/api/admin/attempts'],
  ['get', '/api/admin/trash'],
]

async function statusFor(method, url, role) {
  const res = await request(app)[method](url).set('Authorization', `Bearer ${token(role)}`).send({})
  return res.status
}

function matrix(title, routes, allowed) {
  describe(title, () => {
    for (const [method, url] of routes) {
      for (const role of ['user', 'teacher', 'admin']) {
        const expectAllowed = allowed.includes(role)
        it(`${method.toUpperCase()} ${url} — ${role} ${expectAllowed ? 'passes the role guard' : 'gets 403'}`, async () => {
          const status = await statusFor(method, url, role)
          if (expectAllowed) expect(status).not.toBe(403)
          else expect(status).toBe(403)
        })
      }
    }
  })
}

matrix('learner-only APIs (exam submit, results, analytics, chatbot)', LEARNER_ONLY, ['user'])
matrix('teacher-only APIs (Practice and Samples management — shown only in the teacher menu)', TEACHER_ONLY, ['teacher'])
matrix('admin-only APIs', ADMIN_ONLY, ['admin'])
matrix('staff APIs shared by admin and teacher', STAFF, ['admin', 'teacher'])
