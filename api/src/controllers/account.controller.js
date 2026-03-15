const db = require('../utils/database')

// ── GET /accounts ─────────────────────────────────
// Devuelve todas las cuentas activas agrupadas con sus totales
exports.list = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      `SELECT * FROM accounts
       WHERE user_id = $1 AND is_active = true
       ORDER BY type, name`,
      [req.user.sub]
    )

    // Calcular total de activos agrupado por tipo (banco, inversión, etc.)
    const totales = rows.reduce((acc, cuenta) => {
      acc[cuenta.type] = (acc[cuenta.type] || 0) + parseFloat(cuenta.balance)
      return acc
    }, {})

    const total_activos = Object.values(totales).reduce((a, b) => a + b, 0)

    res.json({
      success: true,
      data: rows,
      summary: {
        totals:       totales,
        total_assets: +total_activos.toFixed(2),
      },
    })
  } catch (err) { next(err) }
}

// ── GET /accounts/:id ─────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      'SELECT * FROM accounts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Cuenta no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── POST /accounts ────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { name, type, institution, balance = 0, currency = 'PEN', color } = req.body

    const { rows } = await db.query_safe(
      `INSERT INTO accounts (user_id, name, type, institution, balance, currency, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.sub, name, type, institution || null, parseFloat(balance), currency, color || null]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── PUT /accounts/:id ─────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const campos  = ['name', 'institution', 'balance', 'currency', 'color', 'is_active']
    const updates = []
    const params  = []

    campos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        params.push(req.body[campo])
        updates.push(`${campo} = $${params.length}`)
      }
    })

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'Sin campos para actualizar' })
    }

    params.push(req.params.id, req.user.sub)
    const { rows } = await db.query_safe(
      `UPDATE accounts SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Cuenta no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── DELETE /accounts/:id ──────────────────────────
// Soft delete: marca como inactiva en lugar de borrar
// Así el historial de transacciones vinculadas se conserva
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query_safe(
      'UPDATE accounts SET is_active = false WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Cuenta no encontrada' })
    }
    res.json({ success: true, message: 'Cuenta desactivada' })
  } catch (err) { next(err) }
}