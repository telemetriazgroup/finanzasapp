import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../store'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const { login, loading, error } = useAuthStore()
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    const res = await login(form.email, form.password)
    if (res.ok) navigate('/')
  }

  return (
    <div className="min-h-screen flex">

      {/* Panel izquierdo — visible solo en pantallas grandes */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-primary-600 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <span className="font-semibold text-xl">FinanzasApp</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Toma el control<br />de tus finanzas
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed">
            Registra ingresos y gastos, visualiza tu liquidez,
            proyecta el pago de deudas y toma mejores decisiones.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Proyecciones',  'Diarias, semanales y mensuales'],
            ['Categorías',    'Organiza cada movimiento'],
            ['Deudas',        'Plan de amortización incluido'],
            ['Liquidez',      'Bancos e inversiones unificados'],
          ].map(([t, d]) => (
            <div key={t} className="bg-white/10 rounded-xl p-4">
              <p className="font-medium text-sm">{t}</p>
              <p className="text-xs text-primary-200 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Iniciar sesión</h2>
          <p className="text-gray-500 text-sm mb-8">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Regístrate
            </Link>
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'} required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}