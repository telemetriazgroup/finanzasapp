const db     = require('../utils/database')
const logger = require('../utils/logger')

// ── GET /transactions ─────────────────────────────
// Devuelve lista paginada con filtros opcionales:
// type, category_id, date_from, date_to, search (descripción)
exports.list = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const {
      page = 1, limit = 20,
      type, category_id,
      date_from, date_to,
      search,
    } = req.query

    const offset     = (parseInt(page) - 1) * parseInt(limit)
    const params     = [userId]
    const conditions = ['t.user_id = $1']

    // Agregar filtros dinámicamente solo si se enviaron
    if (type) {
      params.push(type)
      conditions.push(`t.type = $${params.length}`)
    }
    if (category_id) {
      params.push(category_id)
      conditions.push(`t.category_id = $${params.length}`)
    }
    if (date_from) {
      params.push(date_from)
      conditions.push(`t.date >= $${params.length}`)
    }
    if (date_to) {
      params.push(date_to)
      conditions.push(`t.date <= $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`t.description ILIKE $${params.length}`)
    }

    const where = conditions.join(' AND ')

    // Primero contamos el total (para calcular páginas)
    const countRes = await db.query_safe(
      `SELECT COUNT(*) FROM transactions t WHERE ${where}`,
      params
    )
    const total = parseInt(countRes.rows[0].count)

    // Luego traemos la página pedida con datos de categoría (JOIN)
    params.push(parseInt(limit))
    params.push(offset)
    const { rows } = await db.query_safe(
      `SELECT
         t.*,
         c.name  AS category_name,
         c.icon  AS category_icon,
         c.color AS category_color
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE ${where}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({
      success: true,
      data: rows,
      meta: {
        total,
        page:        parseInt(page),
        limit:       parseInt(limit),
        total_pages: Math.ceil(total / parseInt(limit)),
      },
    })
  } catch (err) { next(err) }
}

// ── GET /transactions/:id ─────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      `SELECT t.*, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [req.params.id, req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── POST /transactions ────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const {
      type, amount, currency,
      description, notes, date,
      category_id, tags, receipt_url, is_recurring,
    } = req.body

    const { rows } = await db.query_safe(
      `INSERT INTO transactions
         (user_id, type, amount, currency, description,
          notes, date, category_id, tags, receipt_url, is_recurring)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        userId,
        type,
        parseFloat(amount),
        currency || 'PEN',
        description || null,
        notes || null,
        date || new Date().toISOString().split('T')[0],
        category_id || null,
        tags || [],
        receipt_url || null,
        is_recurring || false,
      ]
    )

    logger.info(`Transacción creada: ${type} S/.${amount} — usuario ${userId}`)
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── PUT /transactions/:id ─────────────────────────
// Solo actualiza los campos que se envían (PATCH semántico con PUT)
exports.update = async (req, res, next) => {
  try {
    const campos   = ['type','amount','currency','description','notes','date','category_id','tags','receipt_url']
    const updates  = []
    const params   = []

    campos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        params.push(req.body[campo])
        updates.push(`${campo} = $${params.length}`)
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' })
    }

    params.push(req.params.id, req.user.sub)
    const { rows } = await db.query_safe(
      `UPDATE transactions SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params
    )

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── DELETE /transactions/:id ──────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query_safe(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Transacción no encontrada' })
    }
    res.json({ success: true, message: 'Transacción eliminada' })
  } catch (err) { next(err) }
}