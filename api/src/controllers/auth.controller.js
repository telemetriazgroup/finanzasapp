const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const db     = require('../utils/database')
const redis  = require('../utils/redis')
const logger = require('../utils/logger')

// ── Helpers para crear tokens ─────────────────────
// Access token: vida corta (15 min) — se usa en cada petición
const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  })

// Refresh token: vida larga (7 días) — se usa solo para pedir un nuevo access token
const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  })

const REFRESH_TTL = 7 * 24 * 60 * 60  // 7 días en segundos (para Redis)

// ── POST /auth/register ───────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, currency = 'PEN', timezone = 'America/Lima' } = req.body

    // Verificar que el email no exista ya
    const existe = await db.query_safe(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )
    if (existe.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Este email ya está registrado',
      })
    }

    // Cifrar la contraseña con bcrypt (costo 12 = balance seguridad/velocidad)
    const salt          = await bcrypt.genSalt(12)
    const password_hash = await bcrypt.hash(password, salt)

    // Insertar el usuario
    const { rows } = await db.query_safe(
      `INSERT INTO users (email, password_hash, full_name, currency, timezone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, currency, timezone, created_at`,
      [email.toLowerCase(), password_hash, full_name, currency, timezone]
    )
    const user = rows[0]

    // Generar par de tokens
    const payload      = { sub: user.id, email: user.email }
    const accessToken  = signAccess(payload)
    const refreshToken = signRefresh(payload)

    // Guardar refresh token en DB y en Redis
    await db.query_safe('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id])
    await redis.setEx(`rt:${user.id}`, REFRESH_TTL, refreshToken)

    logger.info(`Nuevo usuario registrado: ${user.email}`)

    res.status(201).json({
      success: true,
      data: {
        user:          { id: user.id, email: user.email, full_name: user.full_name, currency: user.currency },
        access_token:  accessToken,
        refresh_token: refreshToken,
      },
    })
  } catch (err) { next(err) }
}

// ── POST /auth/login ──────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Buscar usuario activo
    const { rows } = await db.query_safe(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    )

    // Usamos el mismo mensaje tanto si el email no existe como si la contraseña es incorrecta
    // Así no revelamos qué emails están registrados (seguridad)
    const user = rows[0]
    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash)
    if (!passwordOk) {
      logger.warn(`Login fallido para: ${email}`)
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
    }

    const payload      = { sub: user.id, email: user.email }
    const accessToken  = signAccess(payload)
    const refreshToken = signRefresh(payload)

    await db.query_safe('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id])
    await redis.setEx(`rt:${user.id}`, REFRESH_TTL, refreshToken)

    logger.info(`Login exitoso: ${user.email}`)

    res.json({
      success: true,
      data: {
        user:          { id: user.id, email: user.email, full_name: user.full_name, currency: user.currency },
        access_token:  accessToken,
        refresh_token: refreshToken,
      },
    })
  } catch (err) { next(err) }
}

// ── POST /auth/refresh ────────────────────────────
// El frontend llama esto cuando el access token expiró
exports.refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body

    // Verificar que el refresh token es válido
    let decoded
    try {
      decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET)
    } catch {
      return res.status(401).json({ success: false, message: 'Refresh token inválido o expirado' })
    }

    // Verificar que coincide con el guardado en Redis (protege contra robo de tokens)
    const stored = await redis.getJson(`rt:${decoded.sub}`)
    if (stored !== refresh_token) {
      return res.status(401).json({ success: false, message: 'Refresh token revocado' })
    }

    // Emitir nuevo access token
    const newAccess = signAccess({ sub: decoded.sub, email: decoded.email })

    res.json({
      success: true,
      data: { access_token: newAccess },
    })
  } catch (err) { next(err) }
}

// ── POST /auth/logout ─────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const userId = req.user.sub

    // Eliminar refresh token de Redis y DB
    await redis.del(`rt:${userId}`)
    await db.query_safe('UPDATE users SET refresh_token = NULL WHERE id = $1', [userId])

    // Agregar el access token a la blacklist hasta que expire naturalmente
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      await redis.blacklistToken(token, 15 * 60)  // 15 minutos
    }

    res.json({ success: true, message: 'Sesión cerrada correctamente' })
  } catch (err) { next(err) }
}

// ── GET /auth/me ──────────────────────────────────
exports.me = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      'SELECT id, email, full_name, currency, timezone, email_verified, created_at FROM users WHERE id = $1',
      [req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}