const { validationResult } = require('express-validator')

// Se usa después de las reglas de express-validator en cada ruta.
// Ejemplo de uso en una ruta:
//   router.post('/login', [
//     body('email').isEmail(),
//     body('password').notEmpty(),
//     validate,               ← este middleware
//   ], authController.login)
module.exports = (req, res, next) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Datos de entrada inválidos',
      // Devolvemos un array de errores con campo y mensaje
      // Ej: [{ field: "email", message: "Email inválido" }]
      errors: errors.array().map(e => ({
        field:   e.path,
        message: e.msg,
      })),
    })
  }

  next()
}