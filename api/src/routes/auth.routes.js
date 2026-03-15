const router   = require('express').Router()
const { body } = require('express-validator')
const validate = require('../middleware/validate.middleware')
const authMW   = require('../middleware/auth.middleware')
const ctrl     = require('../controllers/auth.controller')

// Regla reutilizable para email
const emailRule = body('email')
  .isEmail().withMessage('Email inválido')
  .normalizeEmail()

// Regla reutilizable para contraseña segura
const passwordRule = body('password')
  .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Debe contener mayúsculas, minúsculas y números')

// POST /api/v1/auth/register
router.post('/register', [
  emailRule,
  passwordRule,
  body('full_name').trim().isLength({ min: 2, max: 255 }).withMessage('Nombre requerido'),
  body('currency').optional().isIn(['PEN','USD','EUR','MXN','COP','CLP','ARS','BRL']),
  validate,
], ctrl.register)

// POST /api/v1/auth/login
router.post('/login', [
  emailRule,
  body('password').notEmpty().withMessage('Contraseña requerida'),
  validate,
], ctrl.login)

// POST /api/v1/auth/refresh
router.post('/refresh', [
  body('refresh_token').notEmpty().withMessage('refresh_token requerido'),
  validate,
], ctrl.refresh)

// POST /api/v1/auth/logout  ← requiere estar autenticado
router.post('/logout', authMW, ctrl.logout)

// GET /api/v1/auth/me  ← requiere estar autenticado
router.get('/me', authMW, ctrl.me)

module.exports = router