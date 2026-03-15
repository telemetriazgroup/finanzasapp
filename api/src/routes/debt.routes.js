const router          = require('express').Router()
const { body, param } = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/debt.controller')

router.use(authMW)

// GET /api/v1/debts
router.get('/', ctrl.list)

// GET /api/v1/debts/:id
router.get('/:id', [
  param('id').isUUID().withMessage('ID inválido'),
  validate,
], ctrl.getOne)

// GET /api/v1/debts/:id/projection  ← tabla de amortización
router.get('/:id/projection', [
  param('id').isUUID(),
  validate,
], ctrl.projection)

// POST /api/v1/debts
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nombre requerido'),
  body('principal_amount')
    .isFloat({ gt: 0 }).withMessage('El monto debe ser mayor a 0'),
  body('interest_rate')
    .isFloat({ min: 0, max: 1 })
    .withMessage('Tasa entre 0 y 1 (ejemplo: 0.12 para 12% anual)'),
  body('monthly_payment').optional().isFloat({ gt: 0 }),
  body('due_date').optional().isDate(),
  body('creditor').optional().trim().isLength({ max: 255 }),
  validate,
], ctrl.create)

// PUT /api/v1/debts/:id
router.put('/:id', [
  param('id').isUUID(),
  body('current_balance').optional().isFloat({ min: 0 }),
  body('monthly_payment').optional().isFloat({ gt: 0 }),
  body('interest_rate').optional().isFloat({ min: 0, max: 1 }),
  body('status').optional().isIn(['active', 'paid', 'defaulted']),
  validate,
], ctrl.update)

// DELETE /api/v1/debts/:id
router.delete('/:id', [
  param('id').isUUID(),
  validate,
], ctrl.remove)

module.exports = router