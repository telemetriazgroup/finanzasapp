import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useAuthStore } from '../store'

const MONEDAS = ['PEN','USD','EUR','MXN','COP','CLP','ARS','BRL']

export default function RegisterPage() {
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', currency: 'PEN',
  })
  const { register, loading, error } = useAuthStore()
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    const res = await register(form)
    if (res.ok) navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900">FinanzasApp</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">Crear cuenta</h2>
        <p className="text-gray-500 text-sm mb-8">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input
              required className="input" placeholder="Juan Pérez"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Correo electrónico</label>
            <input
              type="email" required className="input"
              placeholder="tu@email.com"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <input
              type="password" required className="input"
              placeholder="Mínimo 8 caracteres, mayúsculas y números"
              value={form.password}
              onChange={e => set('password', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Moneda principal</label>
            <select
              className="input bg-white"
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
            >
              {MONEDAS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}