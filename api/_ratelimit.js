import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Límits per endpoint — sliding window
export const limiters = {
  checkout:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '1 m') }),
  connectStripe: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '1 m') }),
  validateAccess:new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }),
  checkStatus:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 m') }),
  register:      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '10 m') }),
  passwordReset: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '15 m') }),
}

// Retorna la IP real del request (Vercel posa x-forwarded-for)
export function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

// Comprova el límit i respon 429 si s'ha excedit. Retorna true si cal aturar.
export async function checkLimit(limiter, req, res) {
  const ip = getIp(req)
  const { success, limit, remaining, reset } = await limiter.limit(ip)
  if (!success) {
    res.setHeader('X-RateLimit-Limit', limit)
    res.setHeader('X-RateLimit-Remaining', 0)
    res.setHeader('X-RateLimit-Reset', reset)
    res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' })
    return true
  }
  return false
}
