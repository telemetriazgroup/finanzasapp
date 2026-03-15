const winston = require('winston')

const { combine, timestamp, json, printf, colorize, errors } = winston.format

// Formato legible para desarrollo (con colores)
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`
})

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',

  format: combine(
    errors({ stack: true }),    // Captura stack traces de errores
    timestamp({ format: 'HH:mm:ss' }),
    // En producción: JSON (fácil de parsear con herramientas de monitoreo)
    // En desarrollo: texto con colores (fácil de leer)
    process.env.NODE_ENV === 'production'
      ? json()
      : combine(colorize(), devFormat)
  ),

  transports: [
    new winston.transports.Console(),
    // En producción también escribir a archivo
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: '/var/log/app/error.log',
        level:    'error',
        maxsize:  5242880,  // 5MB por archivo
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: '/var/log/app/app.log',
        maxsize:  5242880,
        maxFiles: 10,
      }),
    ] : []),
  ],
})

// Nivel extra para logs HTTP de Morgan
logger.http = (msg) => logger.log('http', msg)

module.exports = logger