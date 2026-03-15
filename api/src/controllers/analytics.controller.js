const db = require('../utils/database')

// ── Helper: calcular rango de fechas por período ──
function getRangoDeFechas(period, date) {
  const ref = new Date(date || new Date())
  let dateFrom, dateTo

  if (period === 'daily') {
    const d = ref.toISOString().split('T')[0]
    dateFrom = d; dateTo = d
  } else if (period === 'weekly') {
    const day = ref.getDay() || 7                    // Lunes = 1 ... Domingo = 7
    const mon = new Date(ref)
    mon.setDate(ref.getDate() - day + 1)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    dateFrom = mon.toISOString().split('T')[0]
    dateTo   = sun.toISOString().split('T')[0]
  } else if (period === 'yearly') {
    dateFrom = `${ref.getFullYear()}-01-01`
    dateTo   = `${ref.getFullYear()}-12-31`
  } else {
    // monthly (default)
    const mes = String(ref.getMonth() + 1).padStart(2, '0')
    dateFrom  = `${ref.getFullYear()}-${mes}-01`
    const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    dateTo = ultimo.toISOString().split('T')[0]
  }
  return { dateFrom, dateTo }
}

// ── GET /analytics/summary ────────────────────────
// Totales de ingresos y gastos en el período + balance + tasa de ahorro
exports.summary = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const { period = 'monthly', date } = req.query
    const { dateFrom, dateTo } = getRangoDeFechas(period, date)

    const { rows } = await db.query_safe(
      `SELECT
         type,
         COUNT(*)    AS count,
         SUM(amount) AS total,
         AVG(amount) AS average
       FROM transactions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY type`,
      [userId, dateFrom, dateTo]
    )

    const income  = rows.find(r => r.type === 'income')  || { total: 0, count: 0 }
    const expense = rows.find(r => r.type === 'expense') || { total: 0, count: 0 }
    const balance = parseFloat(income.total || 0) - parseFloat(expense.total || 0)

    res.json({
      success: true,
      data: {
        period,
        date_from: dateFrom,
        date_to:   dateTo,
        income: {
          total:   +parseFloat(income.total  || 0).toFixed(2),
          count:   parseInt(income.count  || 0),
          average: +parseFloat(income.average  || 0).toFixed(2),
        },
        expense: {
          total:   +parseFloat(expense.total || 0).toFixed(2),
          count:   parseInt(expense.count || 0),
          average: +parseFloat(expense.average || 0).toFixed(2),
        },
        balance:      +balance.toFixed(2),
        // Porcentaje del ingreso que se ahorró (o se perdió si es negativo)
        savings_rate: income.total > 0
          ? +(balance / parseFloat(income.total) * 100).toFixed(1)
          : 0,
      },
    })
  } catch (err) { next(err) }
}

// ── GET /analytics/by-category ────────────────────
// Desglose de gastos e ingresos por categoría con porcentaje del total
exports.byCategory = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const { period = 'monthly', date } = req.query
    const { dateFrom, dateTo } = getRangoDeFechas(period, date)

    const { rows } = await db.query_safe(
      `SELECT
         c.id, c.name, c.icon, c.color,
         t.type,
         COUNT(t.id)   AS count,
         SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1 AND t.date BETWEEN $2 AND $3
       GROUP BY c.id, c.name, c.icon, c.color, t.type
       ORDER BY total DESC`,
      [userId, dateFrom, dateTo]
    )

    // Calcular total de gastos para obtener porcentajes
    const totalGasto = rows
      .filter(r => r.type === 'expense')
      .reduce((s, r) => s + parseFloat(r.total), 0)

    const data = rows.map(r => ({
      ...r,
      total:      +parseFloat(r.total).toFixed(2),
      count:      parseInt(r.count),
      percentage: r.type === 'expense' && totalGasto > 0
        ? +(parseFloat(r.total) / totalGasto * 100).toFixed(1)
        : null,
    }))

    res.json({
      success: true,
      data,
      meta: { date_from: dateFrom, date_to: dateTo },
    })
  } catch (err) { next(err) }
}

// ── GET /analytics/projection ─────────────────────
// Proyección de flujo de caja futuro basada en promedio de los últimos 3 meses
exports.projection = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const months = parseInt(req.query.months) || 6

    // Promedio mensual histórico (últimos 3 meses)
    const { rows: hist } = await db.query_safe(
      `SELECT type, AVG(monthly_total) AS avg_monthly
       FROM (
         SELECT type,
           DATE_TRUNC('month', date) AS month,
           SUM(amount)               AS monthly_total
         FROM transactions
         WHERE user_id = $1
           AND date >= CURRENT_DATE - INTERVAL '3 months'
         GROUP BY type, DATE_TRUNC('month', date)
       ) sub
       GROUP BY type`,
      [userId]
    )

    const avgIncome  = parseFloat(hist.find(r => r.type === 'income')?.avg_monthly  || 0)
    const avgExpense = parseFloat(hist.find(r => r.type === 'expense')?.avg_monthly || 0)

    // Sumar cuotas mensuales de deudas activas
    const { rows: debtRows } = await db.query_safe(
      `SELECT COALESCE(SUM(monthly_payment), 0) AS total
       FROM debts WHERE user_id = $1 AND status = 'active'`,
      [userId]
    )
    const monthlyDebt = parseFloat(debtRows[0].total)

    // Saldo actual en todas las cuentas activas
    const { rows: accRows } = await db.query_safe(
      `SELECT COALESCE(SUM(balance), 0) AS total
       FROM accounts WHERE user_id = $1 AND is_active = true`,
      [userId]
    )
    let saldoActual = parseFloat(accRows[0].total)

    // Construir la proyección mes a mes
    const projection = []
    for (let i = 1; i <= months; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const mesLabel  = d.toISOString().split('T')[0].slice(0, 7)
      const netFlow   = avgIncome - avgExpense - monthlyDebt
      saldoActual    += netFlow

      projection.push({
        month:       mesLabel,
        avg_income:  +avgIncome.toFixed(2),
        avg_expense: +(avgExpense + monthlyDebt).toFixed(2),
        net_flow:    +netFlow.toFixed(2),
        balance_end: +saldoActual.toFixed(2),
      })
    }

    res.json({
      success: true,
      data: projection,
      meta: {
        months,
        avg_monthly_income:       +avgIncome.toFixed(2),
        avg_monthly_expense:      +avgExpense.toFixed(2),
        monthly_debt_commitments: +monthlyDebt.toFixed(2),
        note: 'Proyección basada en el promedio de los últimos 3 meses',
      },
    })
  } catch (err) { next(err) }
}

// ── GET /analytics/net-worth ──────────────────────
// Patrimonio neto = total de activos (cuentas) − total de deudas
exports.netWorth = async (req, res, next) => {
  try {
    const userId = req.user.sub

    const [assetsRes, debtsRes] = await Promise.all([
      db.query_safe(
        `SELECT type, SUM(balance) AS total
         FROM accounts WHERE user_id = $1 AND is_active = true
         GROUP BY type`,
        [userId]
      ),
      db.query_safe(
        `SELECT COALESCE(SUM(current_balance), 0) AS total
         FROM debts WHERE user_id = $1 AND status = 'active'`,
        [userId]
      ),
    ])

    const assets      = assetsRes.rows
    const totalDebt   = parseFloat(debtsRes.rows[0].total)
    const totalAssets = assets.reduce((s, r) => s + parseFloat(r.total), 0)
    const netWorth    = totalAssets - totalDebt

    res.json({
      success: true,
      data: {
        assets:       assets.map(r => ({ type: r.type, total: +parseFloat(r.total).toFixed(2) })),
        total_assets: +totalAssets.toFixed(2),
        total_debts:  +totalDebt.toFixed(2),
        net_worth:    +netWorth.toFixed(2),
        is_positive:  netWorth >= 0,
      },
    })
  } catch (err) { next(err) }
}

// ── GET /analytics/cash-flow ──────────────────────
// Ingresos y gastos agrupados por día en las últimas N semanas
exports.cashFlow = async (req, res, next) => {
  try {
    const userId = req.user.sub
    const weeks  = parseInt(req.query.weeks) || 4

    const { rows } = await db.query_safe(
      `SELECT
         date,
         SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1
         AND date >= CURRENT_DATE - ($2 * INTERVAL '1 week')
       GROUP BY date
       ORDER BY date ASC`,
      [userId, weeks]
    )

    const data = rows.map(r => ({
      date:    r.date,
      income:  +parseFloat(r.income).toFixed(2),
      expense: +parseFloat(r.expense).toFixed(2),
      net:     +(parseFloat(r.income) - parseFloat(r.expense)).toFixed(2),
    }))

    res.json({ success: true, data })
  } catch (err) { next(err) }
}