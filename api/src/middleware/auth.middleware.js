const jwt   = require('jsonwebtoken')
const redis = require('../utils/redis')

// Este middleware se aplica a todas las rutas que requieren login.
// Si el token falla → 401. Si pasa → siguiente middleware o controller.
module.exports = async (req, res, next) => {
  try {
    // 1. Extraer el token del header Authorization
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido',
      })
    }
    const token = authHeader.split(' ')[1]

    // 2. Verificar que el token no fue revocado (logout previo)
    // Esto consulta Redis — si está en la blacklist, el token fue invalidado
    const bloqueado = await redis.isTokenBlacklisted(token)
    if (bloqueado) {
      return res.status(401).json({
        success: false,
        message: 'Sesión cerrada. Por favor inicia sesión de nuevo.',
      })
    }

    // 3. Verificar firma y expiración del JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 4. Adjuntar datos del usuario al request para que los usen los controllers
    // decoded.sub = ID del usuario, decoded.email = email
    req.user = decoded
    next()

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code:    'TOKEN_EXPIRED',  // El frontend detecta este código para hacer refresh
      })
    }
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
    })
  }
}