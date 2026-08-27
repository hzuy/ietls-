import { describe, it, expect, vi } from 'vitest'
const validate = require('./validate')
const { z } = require('zod')

describe('validate middleware', () => {
  const testSchema = z.object({
    name: z.string().min(1, { message: 'Tên không được để trống' }),
    age: z.coerce.number({ message: 'Tuổi phải là số' }),
  })

  it('calls next() and updates req.body when validation passes', () => {
    const middleware = validate(testSchema)
    const req = { body: { name: 'John Doe', age: '25' } }
    const res = { status: vi.fn(), json: vi.fn() }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.body).toEqual({ name: 'John Doe', age: 25 }) // Coerced
  })

  it('returns 400 error format when validation fails', () => {
    const middleware = validate(testSchema)
    const req = { body: { name: '', age: 'invalid' } }
    const jsonFn = vi.fn()
    const statusFn = vi.fn().mockReturnValue({ json: jsonFn })
    const res = { status: statusFn, json: jsonFn }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(statusFn).toHaveBeenCalledWith(400)
    expect(jsonFn).toHaveBeenCalledWith({
      message: 'Dữ liệu không hợp lệ',
      errors: [
        { field: 'name', message: 'Tên không được để trống' },
        { field: 'age', message: 'Tuổi phải là số' }
      ]
    })
  })

  it('validates req.query and exposes coerced data on req.validatedQuery', () => {
    const middleware = validate(testSchema, 'query')
    // Express 5 makes req.query a getter-only property; the middleware must not
    // try to reassign it, and must surface validated data on req.validatedQuery.
    const req = { query: { name: 'Alice', age: '30' } }
    const res = { status: vi.fn(), json: vi.fn() }
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.validatedQuery).toEqual({ name: 'Alice', age: 30 }) // Coerced
    expect(req.query).toEqual({ name: 'Alice', age: '30' }) // Original untouched
  })
})
