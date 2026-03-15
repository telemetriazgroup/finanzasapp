import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { analyticsAPI } from '../api/client'
import { useAuthStore } from '../store'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Formato de moneda local
function useFmt(currency = 'PEN') {
  return v => new Intl.NumberFormat('es-PE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(v ?? 0)
}

// Colores para el gráfico de torta
const COLORES = ['#22c55e','#ef4444','#f59e0b','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316']

function KPICard({ label, value, sub, icon: Icon, colorClass }) {
  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={17} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user }  = useAuthStore()
  const fmt       = useFmt(user?.currency)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsAPI.summary({ period: 'monthly' }),
      analyticsAPI.cashFlow({ weeks: 4 }),
      analyticsAPI.byCategory({ period: 'monthly' }),
      analyticsAPI.netWorth(),
    ]).then(([s, cf, bc, nw]) => {
      setData({
        summary:  s.data.data,
        cashFlow: cf.data.data.map(d => ({
          ...d,
          label: format(parseISO(d.date), 'd MMM', { locale: es }),
        })),
        byCat:    bc.data.data.filter(r => r.type === 'expense').slice(0, 8),
        netWorth: nw.data.data,
      })
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Cargando dashboard...
    </div>
  )

  const { summary, cashFlow, byCat, netWorth } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Hola, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen financiero de este mes</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard label="Ingresos del mes"  value={fmt(summary.income.total)}
          sub={`${summary.income.count} transacciones`}
          icon={TrendingUp}   colorClass="bg-green-50 text-green-600" />
        <KPICard label="Gastos del mes"    value={fmt(summary.expense.total)}
          sub={`${summary.expense.count} transacciones`}
          icon={TrendingDown} colorClass="bg-red-50 text-red-500" />
        <KPICard label="Balance neto"      value={fmt(summary.balance)}
          sub={`Ahorro: ${summary.savings_rate}%`}
          icon={Wallet}       colorClass="bg-blue-50 text-blue-600" />
        <KPICard label="Patrimonio neto"   value={fmt(netWorth.net_worth)}
          sub={`Activos: ${fmt(netWorth.total_assets)}`}
          icon={CreditCard}   colorClass="bg-purple-50 text-purple-600" />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Área: flujo de caja */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Flujo de caja — últimas 4 semanas</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cashFlow} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label"  tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis                  tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmt(v).slice(0, 7)} />
              <Tooltip
                formatter={(v, n) => [fmt(v), n === 'income' ? 'Ingresos' : 'Gastos']}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="income"  stroke="#22c55e" strokeWidth={2} fill="url(#gI)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#gE)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Torta: gastos por categoría */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Por categoría</h3>
          {byCat.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byCat} dataKey="total" nameKey="name"
                  cx="50%" cy="45%" innerRadius={50} outerRadius={80}
                  paddingAngle={3} strokeWidth={0}>
                  {byCat.map((c, i) => (
                    <Cell key={i} fill={c.color || COLORES[i % COLORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={v => [fmt(v)]}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              Sin gastos este mes
            </div>
          )}
        </div>
      </div>

      {/* Distribución de activos */}
      {netWorth.assets.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Distribución de activos</h3>
          <div className="flex flex-wrap gap-3">
            {netWorth.assets.map(a => (
              <div key={a.type} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="w-2 h-8 rounded-full bg-primary-500" />
                <div>
                  <p className="text-xs text-gray-400 capitalize">{a.type}</p>
                  <p className="font-semibold text-gray-900 text-sm">{fmt(a.total)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 bg-red-50 rounded-xl px-4 py-3">
              <div className="w-2 h-8 rounded-full bg-red-400" />
              <div>
                <p className="text-xs text-gray-400">Deudas</p>
                <p className="font-semibold text-red-500 text-sm">{fmt(netWorth.total_debts)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}