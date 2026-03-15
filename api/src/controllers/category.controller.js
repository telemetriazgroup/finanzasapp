const db = require('../utils/database')

// ── GET /categories ───────────────────────────────
// Devuelve: categorías globales (is_default=true) + las del usuario
// Las ordena: primero por tipo (income/expense), luego globales antes que personalizadas
exports.list = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      `SELECT * FROM categories
       WHERE is_default = true OR user_id = $1
       ORDER BY type DESC, is_default DESC, name ASC`,
      [req.user.sub]
    )
    res.json({ success: true, data: rows })
  } catch (err) { next(err) }
}

// ── POST /categories ──────────────────────────────
// Crea una categoría personalizada para el usuario
exports.create = async (req, res, next) => {
  try {
    const { name, type, icon, color } = req.body
    const { rows } = await db.query_safe(
      `INSERT INTO categories (user_id, name, type, icon, color)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.sub, name, type, icon || null, color || null]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── PUT /categories/:id ───────────────────────────
// Solo edita categorías propias del usuario (no las globales)
exports.update = async (req, res, next) => {
  try {
    const { name, icon, color } = req.body
    const { rows } = await db.query_safe(
      `UPDATE categories
       SET
         name  = COALESCE($1, name),
         icon  = COALESCE($2, icon),
         color = COALESCE($3, color)
       WHERE id = $4
         AND user_id = $5
         AND is_default = false
       RETURNING *`,
      [name || null, icon || null, color || null, req.params.id, req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada o no se puede editar (es una categoría global)',
      })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── DELETE /categories/:id ────────────────────────
// Solo borra categorías propias — las globales son permanentes
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query_safe(
      `DELETE FROM categories
       WHERE id = $1 AND user_id = $2 AND is_default = false`,
      [req.params.id, req.user.sub]
    )
    if (!rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada o no se puede eliminar (es una categoría global)',
      })
    }
    res.json({ success: true, message: 'Categoría eliminada' })
  } catch (err) { next(err) }
}