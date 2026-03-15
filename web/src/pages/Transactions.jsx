import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, TrendingUp, TrendingDown, Pencil, Trash2 } from 'lucide-react'
import { transactionsAPI, categoriesAPI } from '../api/client'
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
  type: 'expense', amount: '', description: '',
  date: new Date().toISOString().split('T')[0],
  category_id: '', notes: '', tags: '',
}

export default function Transactions() {
  const { user }  = useAuthStore()
  const { toast } = useUIStore()
  const fmt       = useFmt(user?.currency)

  const [filas,      setFilas]      = useState([])
  const [categorias, setCategorias] = useState([])
  const [meta,       setMeta]       = useState({})
  const [cargando,   setCargando]   = useState(true)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editando,   setEditando]   = useState(null)
  const [form,       setForm]       = useState(FORM_VACIO)
  const [guardando,  setGuardando]  = useState(false)
  const [filtros,    setFiltros]    = useState({ page: 1, limit: 20, type: '', search: '' })

  // Cargar categorías una vez
  useEffect(() => {
    categoriesAPI.list().then(r => setCategorias(r.data.data)).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const params = { ...filtros }
      if (!params.type)   delete params.type
      if (!params.search) delete params.search
      const r = await transactionsAPI.list(params)
      setFilas(r.data.data)
      setMeta(r.data.meta)
    } catch { toast('Error al cargar transacciones', 'error') }
    finally { setCargando(false) }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const abrirCrear = () => { setEditando(null); setForm(FORM_VACIO); setModalOpen(true) }
  const abrirEditar = fila => {
    setEditando(fila)
    setForm({
      type:        fila.type,
      amount:      fila.amount,
      description: fila.description || '',
      date:        fila.date?.split('T')[0] || fila.date,
      category_id: fila.category_id || '',
      notes:       fila.notes || '',
      tags:        (fila.tags || []).join(', '),
    })
    setModalOpen(true)
  }

  const guardar = async e => {
    e.preventDefault()
    setGuardando(true)
    try {
      const payload = {
        ...form,
        amount:      parseFloat(form.amount),
        tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        category_id: form.category_id || undefined,
      }
      if (editando) {
        await transactionsAPI.update(editando.id, payload)
        toast('Transacción actualizada')
      } else {
        await transactionsAPI.create(payload)
        toast('Transacción registrada')
      }
      setModalOpen(false)
      cargar()
    } catch (err) {
      toast(err.response?.data?.message || 'Error al guardar', 'error')
    } finally { setGuardando(false) }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar esta transacción?')) return
    try { await transactionsAPI.remove(id); toast('Eliminada'); cargar() }
    catch { toast('Error al eliminar', 'error') }
  }

  const catsFiltradas = categorias.filter(c => c.type === form.type)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transacciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total ?? 0} registros totales</p>
        </div>
        <button onClick={abrirCrear} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva transacción
        </button>
      </div>

      {/* Filtros */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 text-sm" placeholder="Buscar descripción..."
            value={filtros.search}
            onChange={e => setFiltros(f => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select className="input w-auto text-sm bg-white"
          value={filtros.type}
          onChange={e => setFiltros(f => ({ ...f, type: e.target.value, page: 1 }))}>
          <option value="">Todos</option>
          <option value="income">Ingresos</option>
          <option value="expense">Gastos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {cargando ? (
          <div className="py-16 text-center text-gray-400 text-sm">Cargando...</div>
        ) : filas.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Sin transacciones.{' '}
            <button onClick={abrirCrear} className="text-primary-600 hover:underline">
              Agregar la primera
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Tipo','Descripción','Categoría','Fecha','Monto',''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filas.map(fila => (
                <tr key={fila.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={fila.type === 'income' ? 'badge-income' : 'badge-expense'}>
                      {fila.type === 'income'
                        ? <TrendingUp size={11} />
                        : <TrendingDown size={11} />}
                      {fila.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 truncate max-w-44">
                      {fila.description || '—'}
                    </p>
                    {fila.tags?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{fila.tags.join(', ')}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {fila.category_name ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: fila.category_color || '#94a3b8' }} />
                        <span className="text-gray-600">{fila.category_name}</span>
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {format(parseISO(fila.date), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-semibold ${fila.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {fila.type === 'income' ? '+' : '-'}{fmt(fila.amount)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1">
                      <button onClick={() => abrirEditar(fila)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => eliminar(fila.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {meta.total_pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Página {meta.page} de {meta.total_pages}
            </span>
            <div className="flex gap-2">
              <button disabled={meta.page <= 1}
                onClick={() => setFiltros(f => ({ ...f, page: f.page - 1 }))}
                className="btn-ghost py-1.5 px-3 text-xs disabled:opacity-40">
                Anterior
              </button>
              <button disabled={meta.page >= meta.total_pages}
                onClick={() => setFiltros(f => ({ ...f, page: f.page + 1 }))}
                className="btn-ghost py-1.5 px-3 text-xs disabled:opacity-40">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? 'Editar transacción' : 'Nueva transacción'}>
        <form onSubmit={guardar} className="space-y-4">
          {/* Selector tipo */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {['expense','income'].map(t => (
              <button key={t} type="button"
                onClick={() => setF('type', t)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors
                  ${form.type === t
                    ? t === 'income' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
                    : 'text-gray-500 hover:bg-gray-50'}`}>
                {t === 'income' ? '↑ Ingreso' : '↓ Gasto'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Monto *</label>
              <input type="number" step="0.01" min="0.01" required
                className="input" placeholder="0.00"
                value={form.amount} onChange={e => setF('amount', e.target.value)} />
            </div>
            <div>
              <label className="label">Fecha *</label>
              <input type="date" required className="input"
                value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Descripción</label>
            <input className="input" placeholder="Ej: Supermercado"
              value={form.description} onChange={e => setF('description', e.target.value)} />
          </div>

          <div>
            <label className="label">Categoría</label>
            <select className="input bg-white"
              value={form.category_id} onChange={e => setF('category_id', e.target.value)}>
              <option value="">Sin categoría</option>
              {catsFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Etiquetas</label>
            <input className="input" placeholder="trabajo, viaje (separadas por comas)"
              value={form.tags} onChange={e => setF('tags', e.target.value)} />
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea rows={2} className="input resize-none"
              placeholder="Notas adicionales..."
              value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary flex-1">
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}