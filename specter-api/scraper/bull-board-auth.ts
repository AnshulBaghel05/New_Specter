import { createHash, timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'

/**
 * HTTP Basic Auth guard for the Bull Board ops dashboard. Kept in its own module
 * (no queue/Redis imports) so it's unit-testable without a live broker.
 *
 * Fails closed: if BULL_BOARD_USER / BULL_BOARD_PASS aren't set the board returns
 * 500, never an open dashboard. Credentials are compared in constant time.
 */
export function safeEqual(a: string, b: string): boolean {
  // Hash to a fixed length first so the compare can't leak the secret's length.
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env.BULL_BOARD_USER
  const pass = process.env.BULL_BOARD_PASS
  if (!user || !pass) {
    res.status(500).send('Bull Board auth not configured')
    return
  }
  const header = req.headers.authorization ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    const [u, p] = Buffer.from(encoded, 'base64').toString('utf8').split(':')
    if (u !== undefined && p !== undefined && safeEqual(u, user) && safeEqual(p, pass)) {
      next()
      return
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="SPECTER Ops"')
  res.status(401).send('Authentication required')
}
