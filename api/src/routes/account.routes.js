const router              = require('express').Router()
const { body, param }     = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/account.controller')

router.use(authMW)

// GET /api/v1/accounts
router.get('/', ctrl.list)

// GET /api/v1/accounts/:id
router.get('/:id', [
  param('id').isUUID().withMessage('ID inválido'),
  validate,
], ctrl.getOne)

// POST /api/v1/accounts
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 255 }),
  body('type')
    .isIn(['bank', 'investment', 'cash', 'crypto'])
    .withMessage('Tipo debe ser bank, investment, cash o crypto'),
  body('balance').optional().isFloat({ min: 0 }).withMessage('El saldo no puede ser negativo'),
  body('currency').optional().isLength({ min: 3, max: 10 }),
  body('institution').optional().trim().isLength({ max: 255 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color hexadecimal inválido'),
  validate,
], ctrl.create)

// PUT /api/v1/accounts/:id
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 255 }),
  body('balance').optional().isFloat({ min: 0 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  validate,
], ctrl.update)

// DELETE /api/v1/accounts/:id
router.delete('/:id', [
  param('id').isUUID(),
  validate,
], ctrl.remove)

module.exports = router