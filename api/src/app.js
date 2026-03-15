const express     = require('express')
const helmet      = require('helmet')
const cors        = require('cors')
const compression = require('compression')
const morgan      = require('morgan')
const rateLimit   = require('express-rate-limit')
const logger      = require('./utils/logger')

// ── Importar todas las rutas ──────────────────────
const authRoutes        = require('./routes/auth.routes')
const transactionRoutes = require('./routes/transaction.routes')
const accountRoutes     = require('./routes/account.routes')
const debtRoutes        = require('./routes/debt.routes')
const categoryRoutes    = require('./routes/category.routes')
const analyticsRoutes   = require('./routes/analytics.routes')

const app = express()

// ── Seguridad ─────────────────────────────────────
// Helmet agrega headers HTTP de seguridad automáticamente
app.use(helmet())

// CORS: en desarrollo permite cualquier origen; en producción solo APP_URL
const corsOrigin = process.env.NODE_ENV === 'development'
  ? true  // localhost, IP del servidor, etc.
  : (process.env.APP_URL || 'http://localhost:5173')
app.use(cors({
  origin:      corsOrigin,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))

// Compresión gzip para respuestas grandes
app.use(compression())

// ── Rate limiting ─────────────────────────────────
// Límite global: 100 peticiones por 15 minutos por IP
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' },
})
app.use(globalLimiter)

// Límite estricto para login/registro: solo 10 intentos por 15 min
// Protege contra ataques de fuerza bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiados intentos de autenticación.' },
})

// ── Parsing de body ───────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Logging HTTP ──────────────────────────────────
// En producción usa formato "combined" (estándar Apache/Nginx)
// En desarrollo usa "dev" (colores, más legible)
app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
  {
    stream: { write: msg => logger.http(msg.trim()) },
    skip:   req => req.path === '/health', // No loguear healthchecks
  }
))

// ── Health check ──────────────────────────────────
// Nginx y Docker usan esta ruta para saber si la API está viva
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'finanzasapp-api',
    time:    new Date().toISOString(),
  })
})

// ── Rutas de la API ───────────────────────────────
const PREFIX = process.env.API_PREFIX || '/api/v1'

app.use(`${PREFIX}/auth`,         authLimiter, authRoutes)
app.use(`${PREFIX}/transactions`, transactionRoutes)
app.use(`${PREFIX}/accounts`,     accountRoutes)
app.use(`${PREFIX}/debts`,        debtRoutes)
app.use(`${PREFIX}/categories`,   categoryRoutes)
app.use(`${PREFIX}/analytics`,    analyticsRoutes)

// ── 404 ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' })
})

// ── Manejador de errores global ───────────────────
// Cualquier error que no se captura en los controllers llega aquí
// En producción NO mostramos el stack trace al cliente
app.use((err, req, res, next) => {
  logger.error(err.stack)
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  })
})

module.exports = app