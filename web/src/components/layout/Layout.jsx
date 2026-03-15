import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Building2,
  CreditCard, BarChart3, Menu, X, LogOut, User,
} from 'lucide-react'
import { useAuthStore, useUIStore } from '../../store'

const NAV = [
  { to: '/',             label: 'Dashboard',     icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transacciones', icon: ArrowLeftRight },
  { to: '/accounts',     label: 'Cuentas',       icon: Building2 },
  { to: '/debts',        label: 'Deudas',        icon: CreditCard },
  { to: '/analytics',   label: 'Análisis',       icon: BarChart3 },
]

export default function Layout() {
  const { user, logout }               = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ──────────────────────────────── */}
      <aside className={`
        flex flex-col bg-white border-r border-gray-100
        transition-all duration-300 shrink-0
        ${sidebarOpen ? 'w-60' : 'w-16'}
      `}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-gray-900 truncate">FinanzasApp</span>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-primary-50 text-primary-700'
                   : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                 }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer del sidebar: usuario + logout */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          <div className={`flex items-center gap-3 px-2 py-2 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <User size={13} className="text-primary-700" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {user?.full_name || 'Usuario'}
                </p>
                <p className="text-xs text-gray-400">{user?.currency}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm
              text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors
              ${!sidebarOpen && 'justify-center'}
            `}
          >
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && 'Cerrar sesión'}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ───────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center gap-3 bg-white border-b border-gray-100 px-5 py-3.5 shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="text-sm text-gray-400">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </span>
        </header>

        {/* Página actual (renderizada por el router) */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}