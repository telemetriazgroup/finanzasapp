import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell, Legend,
} from 'recharts'
import { analyticsAPI } from '../api/client'
import { useAuthStore } from '../store'

function useFmt(currency = 'PEN') {
  return v => new Intl.NumberFormat('es-PE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(v ?? 0)
}

const COLORES = ['#22c55e','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316']

const PERIODOS = [
  { value: 'weekly',  label: 'Esta semana' },
  { value: 'monthly', label: 'Este mes' },
  { value: 'yearly',  label: 'Este año' },
]

export default function Analytics() {
  const { user } = useAuthStore()
  const fmt      = useFmt(user?.currency)

  const [periodo,    setPeriodo]    = useState('monthly')
  const [summary,    setSummary]    = useState(null)
  const [byCat,      setByCat]      = useState([])
  const [proyeccion, setProyeccion] = useState([])
  const [meses,      setMeses]      = useState(6)
  const [cargando,   setCargando]   = useState(true)

  // Cargar resumen y categorías cuando cambia el período
  useEffect(() => {
    setCargando(true)
    Promise.all([
      analyticsAPI.summary({ period: periodo }),
      analyticsAPI.byCategory({ period: periodo }),
    ]).then(([s, bc]) => {
      setSummary(s.data.data)
      setByCat(bc.data.data.filter(r => r.type === 'expense'))
    }).catch(console.error)
    .finally(() => setCargando(false))
  }, [periodo])

  // Cargar proyección cuando cambia el número de meses
  useEffect(() => {
    analyticsAPI.projection({ months: meses })
      .then(r => setProyeccion(r.data.data))
      .catch(console.error)
  }, [meses])

  const barData = [
    { name: 'Ingresos', value: summary?.income.total  || 0, fill: '#22c55e' },
    { name: 'Gastos',   value: summary?.expense.total || 0, fill: '#ef4444' },
    { name: 'Balance',  value: Math.max(0, summary?.balance || 0), fill: '#3b82f6' },
  ]

  return (
    <div className="space-y-6">

      {/* Header con selector de período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Análisis financiero</h1>
          <p className="text-sm text-gray-500 mt-0.5">Proyecciones y desglose de gastos</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODOS.map(p => (
            <button key={p.value} onClick={() => setPeriodo(p.value)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${periodo === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="py-20 text-center text-gray-400 text-sm">Cargando análisis...</div>
      ) : (
        <>
          {/* KPIs del período */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Ingresos',      value: fmt(summary?.income.total),  sub: `${summary?.income.count} transacciones`,  color: 'text-green-600' },
              { label: 'Gastos',        value: fmt(summary?.expense.total), sub: `${summary?.expense.count} transacciones`, color: 'text-red-500'   },
              { label: 'Tasa de ahorro', value: `${summary?.savings_rate}%`, sub: 'del ingreso total',
                color: (summary?.savings_rate ?? 0) >= 0 ? 'text-blue-600' : 'text-red-500' },
            ].map(k => (
              <div key={k.label} className="card">
                <p className="text-sm text-gray-500">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Barras: ingresos vs gastos vs balance */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Ingresos vs gastos</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => fmt(v).slice(0, 8)} />
                <Tooltip formatter={v => [fmt(v)]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Barras horizontales por categoría */}
          {byCat.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Gastos por categoría</h3>
              <div className="space-y-3">
                {byCat.map((cat, i) => (
                  <div key={cat.id || i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full"
                          style={{ background: cat.color || COLORES[i % COLORES.length] }} />
                        <span className="text-sm text-gray-700">{cat.name || 'Sin categoría'}</span>
                        <span className="text-xs text-gray-400">{cat.count} mov.</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">{cat.percentage}%</span>
                        <span className="text-sm font-semibold text-gray-900">{fmt(cat.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width:      `${cat.percentage || 0}%`,
                          background: cat.color || COLORES[i % COLORES.length],
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Proyección de flujo de caja */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Proyección de flujo de caja</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Meses:</span>
            {[3, 6, 12].map(m => (
              <button key={m} onClick={() => setMeses(m)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors
                  ${meses === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {proyeccion.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={proyeccion} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => fmt(v).slice(0, 8)} />
                <Tooltip
                  formatter={(v, n) => [fmt(v), {
                    avg_income: 'Ingreso prom.', avg_expense: 'Gasto prom.',
                    balance_end: 'Saldo proy.', net_flow: 'Flujo neto',
                  }[n] || n]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="avg_income"  name="Ingreso prom."
                  stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="avg_expense" name="Gasto prom."
                  stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="balance_end" name="Saldo proy."
                  stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>

            {/* Tabla resumen */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {['Mes','Ingreso prom.','Gasto prom.','Flujo neto','Saldo final'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {proyeccion.map(r => (
                    <tr key={r.month} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.month}</td>
                      <td className="px-3 py-2 text-green-600">{fmt(r.avg_income)}</td>
                      <td className="px-3 py-2 text-red-500">{fmt(r.avg_expense)}</td>
                      <td className={`px-3 py-2 font-medium ${r.net_flow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {r.net_flow >= 0 ? '+' : ''}{fmt(r.net_flow)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">{fmt(r.balance_end)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-gray-400 text-sm">
            Registra transacciones para generar proyecciones
          </div>
        )}
      </div>
    </div>
  )
}