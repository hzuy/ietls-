import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = { user: { findUnique: vi.fn() } }
const prismaPath = require.resolve('./prisma')
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaMock }

const authUserPath = require.resolve('./authUser')
delete require.cache[authUserPath]
const { verifySession } = require('./authUser')

let nextId = 1000
const freshId = () => ++nextId

describe('verifySession — role and account state come from the database, not the token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts an active account whose role matches the token', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'teacher', isLocked: false, deletedAt: null })
    expect(await verifySession({ userId: id, role: 'teacher' })).toBeNull()
  })

  it('rejects a deleted or missing account with 401', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', isLocked: true, deletedAt: new Date() })
    expect(await verifySession({ userId: id, role: 'user' })).toMatchObject({ status: 401 })

    const missing = freshId()
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await verifySession({ userId: missing, role: 'user' })).toMatchObject({ status: 401 })
  })

  it('rejects a locked account with 403', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', isLocked: true, deletedAt: null })
    expect(await verifySession({ userId: id, role: 'user' })).toMatchObject({ status: 403 })
  })

  it('rejects a token issued before the role was changed (demoted admin keeps no admin rights)', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'teacher', isLocked: false, deletedAt: null })
    expect(await verifySession({ userId: id, role: 'admin' })).toMatchObject({ status: 401 })
  })

  it('rejects malformed token payloads without touching the database', async () => {
    expect(await verifySession({ role: 'admin' })).toMatchObject({ status: 401 })
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('reads security state fresh on every request, including other process updates', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', isLocked: false, deletedAt: null })
    await verifySession({ userId: id, role: 'user' })
    await verifySession({ userId: id, role: 'user' })
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2)

    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', isLocked: true, deletedAt: null })
    expect(await verifySession({ userId: id, role: 'user' })).toMatchObject({ status: 403 })
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(3)
  })

  it('accepts legacy tokens only while the account version remains zero', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', tokenVersion: 0 })
    expect(await verifySession({ userId: id, role: 'user' })).toBeNull()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'user', tokenVersion: 1 })
    expect(await verifySession({ userId: id, role: 'user' })).toMatchObject({ status: 401, code: 'SESSION_REVOKED' })
    expect(await verifySession({ userId: id, role: 'user', tokenVersion: 1 })).toBeNull()
  })

  it('enforces mandatory changes unless explicitly allowed, without trapping Google-only accounts', async () => {
    const id = freshId()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'teacher', password: 'hash', requirePasswordChange: true })
    const token = { userId: id, role: 'teacher' }
    expect(await verifySession(token)).toMatchObject({ status: 403, code: 'PASSWORD_CHANGE_REQUIRED' })
    expect(await verifySession(token, { allowPasswordChange: true })).toBeNull()
    prismaMock.user.findUnique.mockResolvedValue({ id, role: 'teacher', password: null, requirePasswordChange: true })
    expect(await verifySession(token)).toBeNull()
  })
})
