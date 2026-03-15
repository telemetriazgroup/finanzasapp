import { useState, useEffect, useCallback } from 'react'
import { Plus, CreditCard, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { debtsAPI } from '../api/client'
import { useAuthStore, useUIStore } from '../store'
import Modal from '../components/ui/Modal'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

function useFmt(currency = 'PEN') {
  return v => new Intl.NumberFormat('es-PE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(v ?? 0)
}

const FORM_VACIO = {
  name: '', creditor: '', principal_amount: '',
  interest_rate: '', monthly_payment: '',
  due_date: '', currency: 'PEN', notes: '',
}

// Tarjeta de deuda individual con proyección expandible
function DebtCard({ deuda, fmt, onEditar, onEliminar }) {
  const [abierto,   setAbierto]   = useState(false)
  const [proyeccion, setProyeccion] = useState(null)
  const [cargandoP,  setCargandoP]  = useState(false)

  const verProyeccion = async () => {
    if (proyeccion) { setAbierto(a => !a); return }
    setCargandoP(true)
    try {
      const r = await debtsAPI.projection(deuda.id)
      setProyeccion(r.data.data)
      setAbierto(true)
    } catch {}
    finally { setCargandoP(false) }
  }

  const graficaData = proyeccion?.schedule
    .filter((_, i) => i % 3 === 0 || i === proyeccion.schedule.length - 1)
    .map(r => ({ mes: `M${r.month}`, saldo: r.remaining_balance }))

  const statusColor = {
    active:   'bg-amber-50 text-amber-700',
    paid:     'bg-green-50 text-green-700',
    defaulted:'bg-red-50 text-red-600',
  }

  return (
    <div className="card">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{deuda.name}</p>
            {deuda.creditor && <p className="text-xs text-gray-400 mt-0.5">{deuda.creditor}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[deuda.status]}`}>
            {deuda.status === 'active' ? 'Activa' : deuda.status === 'paid' ? 'Pagada' : 'En mora'}
          </span>
          <button onClick={() => onEditar(deuda)}
            className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onEliminar(deuda.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-400">Saldo actual</p>
          <p className="font-bold text-red-500 mt-0.5 text-sm">{fmt(deuda.current_balance)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-400">Tasa anual</p>
          <p className="font-bold text-gray-900 mt-0.5 text-sm">
            {(parseFloat(deuda.interest_rate) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
          <p className="text-xs text-gray-400">Cuota mensual</p>
          <p className="font-bold text-gray-900 mt-0.5 text-sm">
            {deuda.monthly_payment ? fmt(deuda.monthly_payment) : '—'}
          </p>
        </div>
      </div>

      {deuda.due_date && (
        <p className="text-xs text-gray-400 mt-3">
          Vencimiento: {format(parseISO(deuda.due_date), "d 'de' MMMM yyyy", { locale: es })}
        </p>
      )}

      {/* Botón proyección */}
      <button onClick={verProyeccion}
        className="flex items-center gap-1.5 mt-4 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors">
        {cargandoP ? 'Calculando...' : abierto ? 'Ocultar proyección' : 'Ver tabla de amortización'}
        {abierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {/* Proyección expandida */}
      {abierto && proyeccion && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-red-400">Total a pagar</p>
              <p className="font-bold text-red-600 text-sm">{fmt(proyeccion.summary.total_paid)}</p>
            </div>
            <div className="bg-amber-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-amber-500">Total intereses</p>
              <p className="font-bold text-amber-700 text-sm">{fmt(proyeccion.summary.total_interest)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl px-3 py-2.5">
              <p className="text-xs text-blue-400">Liquidación</p>
              <p className="font-bold text-blue-700 text-sm">
                {format(parseISO(proyeccion.summary.payoff_date), 'MMM yyyy', { locale: es })}
              </p>
            </div>
          </div>

          {/* Gráfica de saldo */}
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={graficaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmt(v).slice(0, 7)} />
              <Tooltip formatter={v => [fmt(v), 'Saldo']}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
              <Line type="monotone" dataKey="saldo" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          {/* Tabla — primeros 12 meses */}
          <div className="overflow-x-auto">
            <p className="text-xs text-gray-400 mb-2">Primeros 12 meses</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {['Mes','Cuota','Capital','Interés','Saldo'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proyeccion.schedule.slice(0, 12).map(r => (
                  <tr key={r.month} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{r.month}</td>
                    <td className="px-3 py-2 font-medium">{fmt(r.payment)}</td>
                    <td className="px-3 py-2 text-green-600">{fmt(r.principal)}</td>
                    <td className="px-3 py-2 text-red-400">{fmt(r.interest)}</td>
                    <td className="px-3 py-2 text-gray-600">{fmt(r.remaining_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proyeccion.schedule.length > 12 && (
              <p className="text-xs text-gray-400 mt-2 px-3">
                + {proyeccion.schedule.length - 12} meses hasta liquidación
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Debts() {
  const { user }  = useAuthStore()
  const { toast } = useUIStore()
  const fmt       = useFmt(user?.currency)

  const [apiData,   setApiData]   = useState(null)
  const [cargando,  setCargando]  = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form,      setForm]      = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try { const r = await debtsAPI.list(); setApiData(r.data) }
    catch { toast('Error al cargar deudas', 'error') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirCrear  = () => { setEditando(null); setForm(FORM_VACIO); setModalOpen(true) }
  const abrirEditar = d => {
    setEditando(d)
    setForm({
      name:             d.name,
      creditor:         d.creditor || '',
      principal_amount: d.principal_amount,
      interest_rate:    (parseFloat(d.interest_rate) * 100).toFixed(2),
      monthly_payment:  d.monthly_payment || '',
      due_date:         d.due_date?.split('T')[0] || '',
      currency:         d.currency,
      notes:            d.notes || '',
    })
    setModalOpen(true)
  }

  const guardar = async e => {
    e.preventDefault()
    setGuardando(true)
    try {
      const payload = {
        ...form,
        principal_amount: parseFloat(form.principal_amount),
        interest_rate:    parseFloat(form.interest_rate) / 100,
        monthly_payment:  form.monthly_payment ? parseFloat(form.monthly_payment) : undefined,
        due_date:         form.due_date || undefined,
      }
      if (editando) {
        await debtsAPI.update(editando.id, {
          interest_rate: payload.interest_rate,
          monthly_payment: payload.monthly_payment,
          due_date: payload.due_date,
          notes: payload.notes,
        })
        toast('Deuda actualizada')
      } else {
        await debtsAPI.create(payload)
        toast('Deuda registrada')
      }
      setModalOpen(false); cargar()
    } catch (err) { toast(err.response?.data?.message || 'Error', 'error') }
    finally { setGuardando(false) }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar esta deuda?')) return
    try { await debtsAPI.remove(id); toast('Deuda eliminada'); cargar() }
    catch { toast('Error al eliminar', 'error') }
  }

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deudas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Seguimiento y proyección de pagos</p>
        </div>
        <button onClick={abrirCrear} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Registrar deuda
        </button>
      </div>

      {/* Total deuda */}
      {apiData?.summary?.total_debt > 0 && (
        <div className="card border-red-100 bg-red-50">
          <p className="text-sm text-red-400 font-medium">Deuda total activa</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{fmt(apiData.summary.total_debt)}</p>
        </div>
      )}

      {cargando ? (
        <div className="py-16 text-center text-gray-400 text-sm">Cargando deudas...</div>
      ) : (apiData?.data || []).length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          Sin deudas registradas.{' '}
          <button onClick={abrirCrear} className="text-primary-600 hover:underline">Agregar la primera</button>
        </div>
      ) : (
        <div className="space-y-4">
          {(apiData?.data || []).map(d => (
            <DebtCard key={d.id} deuda={d} fmt={fmt}
              onEditar={abrirEditar} onEliminar={eliminar} />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? 'Editar deuda' : 'Registrar deuda'}>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="label">Nombre de la deuda *</label>
            <input required className="input" placeholder="Ej: Préstamo personal BCP"
              value={form.name} onChange={e => setF('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Acreedor</label>
            <input className="input" placeholder="Banco, persona, empresa..."
              value={form.creditor} onChange={e => setF('creditor', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monto original *</label>
              <input type="number" required step="0.01" min="0.01" className="input"
                placeholder="0.00" value={form.principal_amount}
                onChange={e => setF('principal_amount', e.target.value)}
                disabled={!!editando} />
            </div>
            <div>
              <label className="label">Tasa anual % *</label>
              <input type="number" required step="0.01" min="0" className="input"
                placeholder="12.5" value={form.interest_rate}
                onChange={e => setF('interest_rate', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cuota mensual</label>
              <input type="number" step="0.01" min="0" className="input"
                placeholder="Se calcula automáticamente"
                value={form.monthly_payment}
                onChange={e => setF('monthly_payment', e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha de vencimiento</label>
              <input type="date" className="input"
                value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea rows={2} className="input resize-none" placeholder="Condiciones, garantías..."
              value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : editando ? 'Guardar' : 'Registrar deuda'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}