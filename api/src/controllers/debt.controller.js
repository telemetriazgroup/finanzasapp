const db = require('../utils/database')

// ── Tabla de amortización francesa ────────────────
// Cada cuota es fija. Al inicio paga más interés, al final más capital.
// balance:        saldo actual de la deuda
// annualRate:     tasa anual como decimal (ej: 0.12 = 12%)
// monthlyPayment: cuota mensual (si es null, se calcula para 360 meses)
function buildAmortizationTable(balance, annualRate, monthlyPayment, maxMonths = 360) {
  const monthlyRate = annualRate / 12
  let remaining     = parseFloat(balance)
  const rows        = []

  // Sin interés: división simple del saldo entre la cuota
  if (monthlyRate === 0) {
    let month = 1
    while (remaining > 0.01 && month <= maxMonths) {
      const payment = Math.min(parseFloat(monthlyPayment || remaining), remaining)
      remaining -= payment
      rows.push({
        month,
        payment:           +payment.toFixed(2),
        principal:         +payment.toFixed(2),
        interest:          0,
        remaining_balance: +Math.max(0, remaining).toFixed(2),
      })
      month++
    }
    return rows
  }

  // Calcular cuota fija si no se proporcionó
  // Fórmula estándar de anualidad: C = P * r / (1 - (1+r)^-n)
  let cuota = parseFloat(monthlyPayment)
  if (!cuota || cuota <= remaining * monthlyRate) {
    cuota = (remaining * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -maxMonths))
  }

  let month = 1
  while (remaining > 0.01 && month <= maxMonths) {
    const interest  = +(remaining * monthlyRate).toFixed(2)
    const principal = +Math.min(cuota - interest, remaining).toFixed(2)
    remaining       = +(remaining - principal).toFixed(2)

    rows.push({
      month,
      payment:           +(principal + interest).toFixed(2),
      principal,
      interest,
      remaining_balance: Math.max(0, remaining),
    })
    month++
  }
  return rows
}

// ── GET /debts ────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      `SELECT *,
         ROUND(interest_rate * 100, 2) AS interest_rate_pct
       FROM debts
       WHERE user_id = $1
       ORDER BY status, due_date NULLS LAST`,
      [req.user.sub]
    )

    // Total de deuda activa
    const total_debt = rows
      .filter(d => d.status === 'active')
      .reduce((sum, d) => sum + parseFloat(d.current_balance), 0)

    res.json({
      success: true,
      data:    rows,
      summary: { total_debt: +total_debt.toFixed(2) },
    })
  } catch (err) { next(err) }
}

// ── GET /debts/:id ────────────────────────────────
exports.getOne = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      'SELECT * FROM debts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Deuda no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── GET /debts/:id/projection ─────────────────────
// Devuelve la tabla de amortización completa + resumen
exports.projection = async (req, res, next) => {
  try {
    const { rows } = await db.query_safe(
      'SELECT * FROM debts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Deuda no encontrada' })
    }

    const debt     = rows[0]
    const schedule = buildAmortizationTable(
      debt.current_balance,
      parseFloat(debt.interest_rate),
      debt.monthly_payment ? parseFloat(debt.monthly_payment) : null
    )

    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0)
    const totalPaid     = schedule.reduce((s, r) => s + r.payment, 0)

    // Fecha estimada de liquidación
    const payoffDate = new Date()
    payoffDate.setMonth(payoffDate.getMonth() + schedule.length)

    res.json({
      success: true,
      data: {
        debt: {
          id:              debt.id,
          name:            debt.name,
          current_balance: debt.current_balance,
          interest_rate:   debt.interest_rate,
          monthly_payment: debt.monthly_payment,
        },
        summary: {
          total_months:   schedule.length,
          total_paid:     +totalPaid.toFixed(2),
          total_interest: +totalInterest.toFixed(2),
          payoff_date:    payoffDate.toISOString().split('T')[0],
        },
        schedule,
      },
    })
  } catch (err) { next(err) }
}

// ── POST /debts ───────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const {
      name, creditor, principal_amount,
      interest_rate, monthly_payment,
      due_date, start_date, currency = 'PEN', notes,
    } = req.body

    const { rows } = await db.query_safe(
      `INSERT INTO debts
         (user_id, name, creditor, principal_amount, current_balance,
          interest_rate, monthly_payment, due_date, start_date, currency, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.sub, name, creditor || null,
        parseFloat(principal_amount),
        parseFloat(principal_amount),  // current_balance = principal al inicio
        parseFloat(interest_rate),
        monthly_payment ? parseFloat(monthly_payment) : null,
        due_date || null,
        start_date || new Date().toISOString().split('T')[0],
        currency, notes || null,
      ]
    )
    res.status(201).json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── PUT /debts/:id ────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const campos  = ['name','creditor','current_balance','interest_rate',
                     'monthly_payment','due_date','status','notes']
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
      `UPDATE debts SET ${updates.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params
    )
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Deuda no encontrada' })
    }
    res.json({ success: true, data: rows[0] })
  } catch (err) { next(err) }
}

// ── DELETE /debts/:id ─────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { rowCount } = await db.query_safe(
      'DELETE FROM debts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub]
    )
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Deuda no encontrada' })
    }
    res.json({ success: true, message: 'Deuda eliminada' })
  } catch (err) { next(err) }
}