const router               = require('express').Router()
const { body, query, param } = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/transaction.controller')

// Todas las rutas requieren autenticación
router.use(authMW)

// GET /api/v1/transactions
// Filtros opcionales: ?type=expense&date_from=2025-01-01&search=supermercado&page=2
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['income', 'expense']),
  query('category_id').optional().isUUID(),
  query('date_from').optional().isDate(),
  query('date_to').optional().isDate(),
  validate,
], ctrl.list)

// GET /api/v1/transactions/:id
router.get('/:id', [
  param('id').isUUID().withMessage('ID inválido'),
  validate,
], ctrl.getOne)

// POST /api/v1/transactions
router.post('/', [
  body('type').isIn(['income', 'expense']).withMessage('Tipo debe ser income o expense'),
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('date').optional().isDate(),
  body('category_id').optional().isUUID(),
  body('tags').optional().isArray(),
  validate,
], ctrl.create)

// PUT /api/v1/transactions/:id
router.put('/:id', [
  param('id').isUUID(),
  body('amount').optional().isFloat({ gt: 0 }),
  body('type').optional().isIn(['income', 'expense']),
  body('description').optional().trim().isLength({ max: 500 }),
  validate,
], ctrl.update)

// DELETE /api/v1/transactions/:id
router.delete('/:id', [
  param('id').isUUID(),
  validate,
], ctrl.remove)

module.exports = router