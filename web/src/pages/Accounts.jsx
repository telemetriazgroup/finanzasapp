import { useState, useEffect, useCallback } from 'react'
import { Plus, Building2, TrendingUp, Wallet, Bitcoin, Pencil, Trash2 } from 'lucide-react'
import { accountsAPI } from '../api/client'
import { useAuthStore, useUIStore } from '../store'
import Modal from '../components/ui/Modal'

function useFmt(currency = 'PEN') {
  return v => new Intl.NumberFormat('es-PE', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(v ?? 0)
}

const TIPOS = {
  bank:       { label: 'Cuenta bancaria', Icon: Building2, css: 'bg-blue-50 text-blue-600' },
  investment: { label: 'Inversión',       Icon: TrendingUp, css: 'bg-purple-50 text-purple-600' },
  cash:       { label: 'Efectivo',        Icon: Wallet,    css: 'bg-green-50 text-green-600' },
  crypto:     { label: 'Criptomoneda',    Icon: Bitcoin,   css: 'bg-amber-50 text-amber-600' },
}

const FORM_VACIO = { name: '', type: 'bank', institution: '', balance: '', currency: 'PEN' }

export default function Accounts() {
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
    try { const r = await accountsAPI.list(); setApiData(r.data) }
    catch { toast('Error al cargar cuentas', 'error') }
    finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const abrirCrear  = () => { setEditando(null); setForm(FORM_VACIO); setModalOpen(true) }
  const abrirEditar = c => {
    setEditando(c)
    setForm({ name: c.name, type: c.type, institution: c.institution || '',
              balance: c.balance, currency: c.currency })
    setModalOpen(true)
  }

  const guardar = async e => {
    e.preventDefault()
    setGuardando(true)
    try {
      const payload = { ...form, balance: parseFloat(form.balance || 0) }
      if (editando) { await accountsAPI.update(editando.id, payload); toast('Cuenta actualizada') }
      else          { await accountsAPI.create(payload);             toast('Cuenta creada') }
      setModalOpen(false); cargar()
    } catch (err) { toast(err.response?.data?.message || 'Error', 'error') }
    finally { setGuardando(false) }
  }

  const eliminar = async id => {
    if (!confirm('¿Desactivar esta cuenta?')) return
    try { await accountsAPI.remove(id); toast('Cuenta desactivada'); cargar() }
    catch { toast('Error al eliminar', 'error') }
  }

  // Agrupar cuentas por tipo
  const grupos = (apiData?.data || []).reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = []
    acc[c.type].push(c)
    return acc
  }, {})

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cuentas y liquidez</h1>
          <p className="text-sm text-gray-500 mt-0.5">Bancos, inversiones, efectivo y cripto</p>
        </div>
        <button onClick={abrirCrear} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva cuenta
        </button>
      </div>

      {/* Resumen total */}
      {apiData?.summary && (
        <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white">
          <p className="text-sm text-primary-100">Total de activos</p>
          <p className="text-3xl font-bold mt-1">{fmt(apiData.summary.total_assets)}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            {Object.entries(apiData.summary.totals).map(([tipo, total]) => (
              <div key={tipo} className="bg-white/10 rounded-xl px-4 py-2">
                <p className="text-xs text-primary-100 capitalize">{TIPOS[tipo]?.label || tipo}</p>
                <p className="font-semibold text-sm">{fmt(total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="py-16 text-center text-gray-400 text-sm">Cargando cuentas...</div>
      ) : Object.keys(grupos).length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          Sin cuentas.{' '}
          <button onClick={abrirCrear} className="text-primary-600 hover:underline">Agregar la primera</button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([tipo, cuentas]) => {
            const { label, Icon, css } = TIPOS[tipo] || { label: tipo, Icon: Building2, css: 'bg-gray-50 text-gray-600' }
            return (
              <div key={tipo}>
                <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                  <Icon size={14} /> {label}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cuentas.map(c => (
                    <div key={c.id} className="card hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${css}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                            {c.institution && <p className="text-xs text-gray-400">{c.institution}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => abrirEditar(c)}
                            className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => eliminar(c.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{fmt(c.balance)}</p>
                      <p className="text-xs text-gray-400 mt-1">{c.currency}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? 'Editar cuenta' : 'Nueva cuenta'}>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="label">Tipo *</label>
            <select className="input bg-white" value={form.type} onChange={e => setF('type', e.target.value)}>
              {Object.entries(TIPOS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nombre *</label>
            <input required className="input" placeholder="Ej: BCP Cuenta Corriente"
              value={form.name} onChange={e => setF('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Institución</label>
            <input className="input" placeholder="Ej: BCP, Interbank, Credicorp"
              value={form.institution} onChange={e => setF('institution', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Saldo actual</label>
              <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
                value={form.balance} onChange={e => setF('balance', e.target.value)} />
            </div>
            <div>
              <label className="label">Moneda</label>
              <select className="input bg-white" value={form.currency} onChange={e => setF('currency', e.target.value)}>
                {['PEN','USD','EUR','MXN','COP','CLP'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : editando ? 'Guardar' : 'Crear cuenta'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}