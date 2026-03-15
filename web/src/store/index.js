import { create } from 'zustand'
import { authAPI } from '../api/client'

// ── Auth store ────────────────────────────────────
// Maneja sesión del usuario: login, logout, registro, perfil
export const useAuthStore = create((set, get) => ({
  user:    null,
  // Si hay token en localStorage el usuario ya estaba logueado
  isAuth:  !!localStorage.getItem('access_token'),
  loading: false,
  error:   null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authAPI.login({ email, password })
      const { user, access_token, refresh_token } = data.data
      localStorage.setItem('access_token',  access_token)
      localStorage.setItem('refresh_token', refresh_token)
      set({ user, isAuth: true, loading: false })
      return { ok: true }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al iniciar sesión'
      set({ loading: false, error: msg })
      return { ok: false, error: msg }
    }
  },

  register: async (payload) => {
    set({ loading: true, error: null })
    try {
      const { data } = await authAPI.register(payload)
      const { user, access_token, refresh_token } = data.data
      localStorage.setItem('access_token',  access_token)
      localStorage.setItem('refresh_token', refresh_token)
      set({ user, isAuth: true, loading: false })
      return { ok: true }
    } catch (err) {
      // Si hay errores de validación, unirlos en un string
      const errors = err.response?.data?.errors
      const msg = errors
        ? errors.map(e => e.message).join('. ')
        : err.response?.data?.message || 'Error al registrarse'
      set({ loading: false, error: msg })
      return { ok: false, error: msg }
    }
  },

  logout: async () => {
    try { await authAPI.logout() } catch {}  // Silenciar errores de red
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuth: false, error: null })
  },

  // Cargar el perfil del usuario al iniciar la app
  fetchMe: async () => {
    try {
      const { data } = await authAPI.me()
      set({ user: data.data })
    } catch {
      get().logout()  // Token inválido → cerrar sesión
    }
  },

  clearError: () => set({ error: null }),
}))

// ── UI store ──────────────────────────────────────
// Estado de la interfaz: sidebar y notificaciones toast
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  toasts: [],

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // Mostrar un toast y auto-eliminarlo después de 4 segundos
  // type: 'success' | 'error' | 'info'
  toast: (message, type = 'success') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
}))