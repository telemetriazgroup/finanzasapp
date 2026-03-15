const router      = require('express').Router()
const { query }   = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/analytics.controller')

router.use(authMW)

// GET /api/v1/analytics/summary?period=monthly&date=2025-03
// Totales de ingresos, gastos, balance y tasa de ahorro
router.get('/summary', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
  query('date').optional().isDate(),
  validate,
], ctrl.summary)

// GET /api/v1/analytics/by-category?period=monthly
// Desglose de gastos e ingresos por categoría con porcentaje
router.get('/by-category', [
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']),
  query('date').optional().isDate(),
  validate,
], ctrl.byCategory)

// GET /api/v1/analytics/projection?months=6
// Proyección de flujo de caja futuro (máximo 24 meses)
router.get('/projection', [
  query('months').optional().isInt({ min: 1, max: 24 }),
  validate,
], ctrl.projection)

// GET /api/v1/analytics/net-worth
// Patrimonio neto: total activos − total deudas
router.get('/net-worth', ctrl.netWorth)

// GET /api/v1/analytics/cash-flow?weeks=4
// Flujo de caja día a día en las últimas N semanas
router.get('/cash-flow', [
  query('weeks').optional().isInt({ min: 1, max: 12 }),
  validate,
], ctrl.cashFlow)

module.exports = router