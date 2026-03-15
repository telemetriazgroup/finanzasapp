import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store'

// Layout y páginas
import Layout       from './components/layout/Layout'
import Toasts       from './components/ui/Toasts'
import LoginPage    from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts     from './pages/Accounts'
import Debts        from './pages/Debts'
import Analytics    from './pages/Analytics'

// Rutas que requieren sesión activa
// Si no hay token → redirige al login
function PrivateRoute({ children }) {
  const isAuth = useAuthStore(s => s.isAuth)
  return isAuth ? children : <Navigate to="/login" replace />
}

// Rutas solo para usuarios NO autenticados (login, registro)
// Si ya hay sesión → redirige al dashboard
function PublicRoute({ children }) {
  const isAuth = useAuthStore(s => s.isAuth)
  return isAuth ? <Navigate to="/" replace /> : children
}

export default function App() {
  const { isAuth, fetchMe } = useAuthStore()

  // Al cargar la app, si hay token en localStorage, cargamos el perfil
  useEffect(() => {
    if (isAuth) fetchMe()
  }, [isAuth])

  return (
    <BrowserRouter>
      {/* Toasts se renderizan sobre todo el contenido */}
      <Toasts />

      <Routes>
        {/* ── Rutas públicas ─────────────────────── */}
        <Route path="/login" element={
          <PublicRoute><LoginPage /></PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute><RegisterPage /></PublicRoute>
        } />

        {/* ── Rutas privadas dentro del Layout ───── */}
        {/* Layout incluye el sidebar y el topbar    */}
        <Route path="/" element={
          <PrivateRoute><Layout /></PrivateRoute>
        }>
          <Route index              element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts"     element={<Accounts />} />
          <Route path="debts"        element={<Debts />} />
          <Route path="analytics"    element={<Analytics />} />
        </Route>

        {/* Cualquier ruta desconocida → inicio */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}