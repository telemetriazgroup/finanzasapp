const { Pool } = require('pg')
const logger   = require('./logger')

// El Pool mantiene un conjunto de conexiones reutilizables.
// DB_POOL_MIN: conexiones siempre abiertas (listas para usar)
// DB_POOL_MAX: máximo de conexiones simultáneas
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  min:      parseInt(process.env.DB_POOL_MIN) || 2,
  max:      parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis:       30000,  // Cerrar conexiones inactivas después de 30s
  connectionTimeoutMillis:  5000,  // Error si no obtiene conexión en 5s
})

// Loguear errores del pool (ej: Postgres se reinició)
pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de PostgreSQL:', err)
})

// Helper para hacer queries con log automático de errores.
// Todos los controllers usan esto en lugar de pool.query() directamente.
pool.query_safe = async (text, params) => {
  try {
    const result = await pool.query(text, params)
    return result
  } catch (err) {
    // Loguear la query fallida (truncada para no exponer datos sensibles)
    logger.error(`Error en query: ${text.substring(0, 100)}`, err.message)
    throw err
  }
}

// Usado por server.js para verificar la conexión al arrancar
pool.authenticate = async () => {
  const client = await pool.connect()
  await client.query('SELECT 1')
  client.release()
}

module.exports = pool