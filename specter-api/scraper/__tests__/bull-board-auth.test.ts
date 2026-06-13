import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { basicAuth, safeEqual } from '../bull-board-auth'

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this },
    send(b: unknown) { this.body = b; return this },
    set(k: string, v: string) { this.headers[k] = v; return this },
  }
  return res as unknown as Response & { statusCode: number; headers: Record<string, string> }
}

function authHeader(user: string, pass: string): string {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

const ENV = { ...process.env }

describe('safeEqual', () => {
  it('matches identical strings and rejects different ones (incl. length)', () => {
    expect(safeEqual('hunter2', 'hunter2')).toBe(true)
    expect(safeEqual('hunter2', 'hunter3')).toBe(false)
    expect(safeEqual('short', 'a-much-longer-secret')).toBe(false)
  })
})

describe('basicAuth', () => {
  beforeEach(() => {
    process.env.BULL_BOARD_USER = 'ops'
    process.env.BULL_BOARD_PASS = 's3cret'
  })
  afterEach(() => {
    process.env = { ...ENV }
    vi.restoreAllMocks()
  })

  it('calls next() with correct credentials', () => {
    const next = vi.fn() as unknown as NextFunction
    const res = mockRes()
    const req = { headers: { authorization: authHeader('ops', 's3cret') } } as unknown as Request
    basicAuth(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(0) // untouched
  })

  it('401s with wrong password', () => {
    const next = vi.fn() as unknown as NextFunction
    const res = mockRes()
    const req = { headers: { authorization: authHeader('ops', 'wrong') } } as unknown as Request
    basicAuth(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
    expect(res.headers['WWW-Authenticate']).toContain('Basic')
  })

  it('401s with no Authorization header', () => {
    const next = vi.fn() as unknown as NextFunction
    const res = mockRes()
    const req = { headers: {} } as unknown as Request
    basicAuth(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('fails closed (500) when the env credentials are not configured', () => {
    delete process.env.BULL_BOARD_USER
    delete process.env.BULL_BOARD_PASS
    const next = vi.fn() as unknown as NextFunction
    const res = mockRes()
    const req = { headers: { authorization: authHeader('ops', 's3cret') } } as unknown as Request
    basicAuth(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(500)
  })
})
