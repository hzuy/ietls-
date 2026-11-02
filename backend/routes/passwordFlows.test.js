import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Persistence is entirely in memory. Never connect to a development or real DB.
let users
let sequence = 20000
let ip
const prisma = {
  user: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma }
// Override the legacy global test stub: these tests must exercise real auth.
for (const modulePath of ['../lib/authUser', '../middleware/auth']) delete require.cache[require.resolve(modulePath)]
const auth = require('../middleware/auth')
const app = express()
app.set('trust proxy', 'loopback')
app.use(express.json())
app.use('/api/auth', require('./auth'))
app.use('/api/admin', require('./admin/users'))
app.get('/protected', auth, (req, res) => res.json({ ok: true }))
const initialPassword = 'original-password'
const initialHash = bcrypt.hashSync(initialPassword, 4)

function seed(role = 'user', extra = {}) {
  const user = { id: ++sequence, email: `person${sequence}@example.test`, name: 'Person', role, password: initialHash, tokenVersion: 0, requirePasswordChange: false, isLocked: false, deletedAt: null, ...extra }
  users.set(user.id, user)
  return user
}
function token(user, claims = {}) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion, ...claims }, process.env.JWT_SECRET, claims.exp ? {} : { expiresIn: '1h' })
}
function change(user, path, body, jwtToken = token(user), limited = false) {
  return request(app).put(path).set('Authorization', `Bearer ${jwtToken}`)
    .set('X-Forwarded-For', ip).set('x-test-rate-limit', String(limited)).send(body)
}
function applyData(user, data) {
  const result = { ...user }
  for (const [key, value] of Object.entries(data)) result[key] = value?.increment ? (user[key] ?? 0) + value.increment : value
  users.set(user.id, result)
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  users = new Map()
  ip = `192.0.2.${++sequence % 200 + 1}`
  process.env.JWT_SECRET = 'password-flow-test-only'
  prisma.user.findUnique.mockImplementation(async ({ where, select }) => {
    const user = where.id ? users.get(where.id) : [...users.values()].find(row => row.email === where.email)
    return user ? select ? Object.fromEntries(Object.keys(select).map(key => [key, user[key]])) : { ...user } : null
  })
  prisma.user.updateMany.mockImplementation(async ({ where, data }) => {
    const user = users.get(where.id)
    if (!user || !Object.entries(where).every(([key, value]) => user[key] === value)) return { count: 0 }
    applyData(user, data)
    return { count: 1 }
  })
  prisma.user.update.mockImplementation(async ({ where, data }) => applyData(users.get(where.id), data))
  prisma.user.create.mockImplementation(async ({ data }) => seed(data.role, data))
  prisma.auditLog.create.mockResolvedValue({ id: 1 })
})

const endpoints = [
  ['user', '/api/auth/change-password', 'oldPassword'],
  ['admin', '/api/admin/me/password', 'currentPassword'],
  ['teacher', '/api/admin/me/password', 'currentPassword'],
]

describe.each(endpoints)('%s password flow', (role, path, currentKey) => {
  it('changes the hash atomically, clears the forced flag, revokes all old sessions and issues a usable login token', async () => {
    const user = seed(role, { requirePasswordChange: true })
    const oldToken = token(user)
    const response = await change(user, path, { [currentKey]: initialPassword, newPassword: 'changed-password' }, oldToken)
    expect(response.status).toBe(200)
    const updated = users.get(user.id)
    expect(updated.tokenVersion).toBe(1)
    expect(updated.requirePasswordChange).toBe(false)
    expect(await bcrypt.compare('changed-password', updated.password)).toBe(true)
    expect(await bcrypt.compare(initialPassword, updated.password)).toBe(false)
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401)
    const failedLogin = await request(app).post('/api/auth/login').send({ email: user.email, password: initialPassword })
    expect(failedLogin.status).toBe(400)
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'changed-password' })
    expect(login.status).toBe(200)
    expect(jwt.verify(login.body.token, process.env.JWT_SECRET).tokenVersion).toBe(1)
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${login.body.token}`)).status).toBe(200)
  })

  it.each([
    ['wrong-password', 'changed-password', 'CURRENT_PASSWORD_INCORRECT'],
    [initialPassword, initialPassword, 'PASSWORD_UNCHANGED'],
  ])('rejects incorrect or unchanged credentials (%s)', async (current, next, code) => {
    const response = await change(seed(role), path, { [currentKey]: current, newPassword: next })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe(code)
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it.each(['1234567', 'a'.repeat(73), 'ế'.repeat(25)])('rejects invalid password policy before writing', async newPassword => {
    const response = await change(seed(role), path, { [currentKey]: initialPassword, newPassword })
    expect(response.status).toBe(400)
    expect(response.body.errors[0].field).toBe('newPassword')
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('handles Google-only accounts without a bcrypt exception and never exposes the hash', async () => {
    const user = seed(role, { password: null, requirePasswordChange: true })
    const response = await change(user, path, { [currentKey]: initialPassword, newPassword: 'changed-password' })
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('PASSWORD_NOT_SET')
    const profile = await request(app).get(role === 'user' ? '/api/auth/me' : '/api/admin/me').set('Authorization', `Bearer ${token(user)}`)
    expect(profile.body.hasPassword).toBe(false)
    expect(profile.body).not.toHaveProperty('password')
    const local = seed(role)
    const localProfile = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token(local)}`)
    expect(localProfile.body.hasPassword).toBe(true)
    expect(JSON.stringify(localProfile.body)).not.toContain(initialHash)
  })

  it('allows only one of two concurrent requests using the same old password', async () => {
    const user = seed(role)
    const responses = await Promise.all([
      change(user, path, { [currentKey]: initialPassword, newPassword: 'first-password' }),
      change(user, path, { [currentKey]: initialPassword, newPassword: 'second-password' }),
    ])
    expect(responses.map(res => res.status).sort()).toEqual([200, 409])
    expect(users.get(user.id).tokenVersion).toBe(1)
  })
})

describe('password authorization and resets', () => {
  it('enforces mandatory changes for every role while allowing profile reads and change endpoints', async () => {
    for (const [role, path, currentKey] of endpoints) {
      const user = seed(role, { requirePasswordChange: true })
      const response = await request(app).get('/protected').set('Authorization', `Bearer ${token(user)}`)
      expect(response.status).toBe(403)
      expect(response.body.code).toBe('PASSWORD_CHANGE_REQUIRED')
      const profile = await request(app).get('/api/auth/me?test=true').set('Authorization', `Bearer ${token(user)}`)
      expect(profile.status).toBe(200)
      expect(profile.body.requirePasswordChange).toBe(true)
      const denied = await request(app).put('/api/auth/profile').set('Authorization', `Bearer ${token(user)}`).send({ name: 'Changed' })
      expect(denied.status).toBe(403)
      expect((await change(user, path, { [currentKey]: 'wrong-password', newPassword: 'new-password' })).body.code).toBe('CURRENT_PASSWORD_INCORRECT')
    }
  })

  it('rejects missing/expired tokens, locked accounts and user access to staff APIs', async () => {
    expect((await request(app).put('/api/auth/change-password').send({})).status).toBe(401)
    const user = seed()
    const expired = token(user, { exp: Math.floor(Date.now() / 1000) - 1 })
    expect((await change(user, '/api/auth/change-password', {}, expired)).status).toBe(401)
    expect((await change(user, '/api/admin/me/password', {})).status).toBe(403)
    const locked = seed('teacher', { isLocked: true })
    expect((await change(locked, '/api/admin/me/password', {})).body.code).toBe('ACCOUNT_LOCKED')
  })

  it('shares account quotas across both API endpoints and returns a retry interval', async () => {
    const user = seed('admin')
    for (let index = 0; index < 5; index++) {
      const path = index % 2 ? '/api/auth/change-password' : '/api/admin/me/password'
      expect((await change(user, path, {}, token(user), true)).status).toBe(400)
    }
    const response = await change(user, '/api/auth/change-password', {}, token(user), true)
    expect(response.status).toBe(429)
    expect(response.body.retryAfter).toBeGreaterThan(0)
    expect(response.headers['retry-after']).toBeDefined()
  })

  it('limits attempts from the same IP even across different accounts', async () => {
    for (let index = 0; index < 20; index++) {
      const user = seed()
      expect((await change(user, '/api/auth/change-password', {}, token(user), true)).status).toBe(400)
    }
    const user = seed()
    expect((await change(user, '/api/auth/change-password', {}, token(user), true)).status).toBe(429)
  })

  it('resets another account with a crypto-generated temporary password, forces a change and revokes sessions', async () => {
    const admin = seed('admin')
    const target = seed('teacher')
    const oldToken = token(target)
    const response = await request(app).post(`/api/admin/users/${target.id}/reset-password`).set('Authorization', `Bearer ${token(admin)}`)
    expect(response.status).toBe(200)
    expect(response.body.newPassword).toHaveLength(12)
    const updated = users.get(target.id)
    expect(updated.requirePasswordChange).toBe(true)
    expect(updated.tokenVersion).toBe(1)
    expect(await bcrypt.compare(response.body.newPassword, updated.password)).toBe(true)
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401)
    expect(JSON.stringify(prisma.auditLog.create.mock.calls)).not.toContain(response.body.newPassword)
    const login = await request(app).post('/api/auth/login').send({ email: target.email, password: response.body.newPassword })
    expect(login.body.requirePasswordChange).toBe(true)
    expect((await request(app).get('/protected').set('Authorization', `Bearer ${login.body.token}`)).body.code).toBe('PASSWORD_CHANGE_REQUIRED')
  })

  it('staff account edits cannot bypass self-service current-password checks', async () => {
    for (const role of ['admin', 'teacher']) {
      const actor = seed(role)
      const response = await request(app).put(`/api/admin/accounts/${actor.id}`).set('Authorization', `Bearer ${token(actor)}`).send({ password: 'new-password' })
      expect(response.status).toBe(400)
    }
    const admin = seed('admin')
    expect((await request(app).post(`/api/admin/users/${admin.id}/reset-password`).set('Authorization', `Bearer ${token(admin)}`)).status).toBe(400)
  })

  it('admin edits of another password force a change and do not trim the chosen password', async () => {
    const admin = seed('admin')
    const teacher = seed('teacher')
    const response = await request(app).put(`/api/admin/accounts/${teacher.id}`).set('Authorization', `Bearer ${token(admin)}`).send({ password: ' new-password ' })
    expect(response.status).toBe(200)
    const updated = users.get(teacher.id)
    expect(updated.requirePasswordChange).toBe(true)
    expect(updated.tokenVersion).toBe(1)
    expect(await bcrypt.compare(' new-password ', updated.password)).toBe(true)
  })

  it('forces a password change on newly created staff accounts', async () => {
    const admin = seed('admin')
    const response = await request(app).post('/api/admin/accounts').set('Authorization', `Bearer ${token(admin)}`)
      .send({ name: 'New Teacher', email: 'newteacher@example.test', role: 'teacher', password: 'temporary-password' })
    expect(response.status).toBe(201)
    const created = [...users.values()].find(user => user.email === 'newteacher@example.test')
    expect(created.requirePasswordChange).toBe(true)
    expect(await bcrypt.compare('temporary-password', created.password)).toBe(true)
  })

  it('fails safely when the database is unavailable and preserves the old password', async () => {
    const user = seed()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    prisma.user.updateMany.mockRejectedValueOnce(new Error('database unavailable'))
    try {
      const response = await change(user, '/api/auth/change-password', { oldPassword: initialPassword, newPassword: 'changed-password' })
      expect(response.status).toBe(500)
      expect(response.body).toEqual({ message: 'Lỗi server' })
      expect(users.get(user.id).password).toBe(initialHash)
      expect(users.get(user.id).tokenVersion).toBe(0)
    } finally { log.mockRestore() }
  })
})
