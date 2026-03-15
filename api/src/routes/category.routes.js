const router          = require('express').Router()
const { body, param } = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/category.controller')

router.use(authMW)

// GET /api/v1/categories
router.get('/', ctrl.list)

// POST /api/v1/categories
router.post('/', [
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Nombre requerido'),
  body('type').isIn(['income', 'expense']).withMessage('Tipo debe ser income o expense'),
  body('icon').optional().trim().isLength({ max: 50 }),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color debe ser hexadecimal válido. Ejemplo: #ff5733'),
  validate,
], ctrl.create)

// PUT /api/v1/categories/:id
router.put('/:id', [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ max: 100 }),
  body('icon').optional().trim().isLength({ max: 50 }),
  body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  validate,
], ctrl.update)

// DELETE /api/v1/categories/:id
router.delete('/:id', [
  param('id').isUUID(),
  validate,
], ctrl.remove)

module.exports = router