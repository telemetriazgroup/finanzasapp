require('dotenv').config()

const app    = require('./app')
const logger = require('./utils/logger')
const db     = require('./utils/database')
const redis  = require('./utils/redis')

const PORT = process.env.PORT || 4000

async function start() {
  try {
    // Verificar conexión a PostgreSQL antes de abrir el puerto
    await db.authenticate()
    logger.info('PostgreSQL conectado')

    // Verificar conexión a Redis
    await redis.ping()
    logger.info('Redis conectado')

    app.listen(PORT, () => {
      logger.info(`API corriendo en :${PORT} [${process.env.NODE_ENV}]`)
    })
  } catch (err) {
    logger.error('Error al iniciar el servidor:', err)
    process.exit(1)
  }
}

// Apagado limpio cuando Docker hace "docker stop"
// Docker envía SIGTERM → cerramos conexiones → salimos
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido — cerrando servidor...')
  try {
    await db.pool.end()
    await redis.quit()
  } catch {}
  process.exit(0)
})

// Loguear errores no capturados en lugar de silenciarlos
process.on('unhandledRejection', (reason) => {
  logger.error('Promise sin capturar:', reason)
})

start()