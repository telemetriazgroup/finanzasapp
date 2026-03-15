const Redis  = require('ioredis')
const logger = require('./logger')

const redis = new Redis({
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  // Si Redis cae, reintenta con espera creciente (máx 10 veces)
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error('Redis: no se pudo reconectar después de 10 intentos')
      return null
    }
    return Math.min(times * 200, 3000)
  },
})

redis.on('connect',     ()    => logger.info('Redis conectado'))
redis.on('error',       (err) => logger.error('Redis error:', err.message))
redis.on('reconnecting',()    => logger.warn('Redis: reconectando...'))

// ── Helper: guardar con expiración ────────────────
// ttlSeconds: cuántos segundos hasta que se borra automáticamente
// value: puede ser objeto (se serializa a JSON)
redis.setEx = async (key, ttlSeconds, value) => {
  return redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
}

// ── Helper: obtener y deserializar JSON ───────────
redis.getJson = async (key) => {
  const val = await redis.get(key)
  if (!val) return null
  try { return JSON.parse(val) } catch { return val }
}

// ── Blacklist de tokens (logout seguro) ───────────
// Cuando un usuario hace logout, guardamos su token en Redis
// con el mismo tiempo de vida que le resta al JWT.
// Así, aunque alguien tenga el token, la API lo rechazará.
redis.blacklistToken = async (token, expiresInSeconds) => {
  return redis.set(`bl:${token}`, '1', 'EX', expiresInSeconds)
}

redis.isTokenBlacklisted = async (token) => {
  const val = await redis.get(`bl:${token}`)
  return val !== null
}

module.exports = redis