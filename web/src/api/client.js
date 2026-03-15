import axios from 'axios'

// Instancia base de Axios — todas las peticiones pasan por aquí
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// ── Interceptor de REQUEST ────────────────────────
// Antes de cada petición, agrega el JWT del localStorage
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Interceptor de RESPONSE ───────────────────────
// Si el servidor responde 401 con code TOKEN_EXPIRED,
// pide un nuevo access token y reintenta la petición original.
// Si el refresh también falla, redirige al login.
let isRefreshing = false
let failedQueue  = []  // Peticiones que esperan el nuevo token

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
  failedQueue = []
}

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config

    const tokenExpirado =
      err.response?.status === 401 &&
      err.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry  // Evitar bucle infinito

    if (!tokenExpirado) return Promise.reject(err)

    // Si ya hay un refresh en curso, encolar esta petición
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing    = true

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(err)
    }

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
        { refresh_token: refreshToken }
      )
      const nuevoToken = data.data.access_token
      localStorage.setItem('access_token', nuevoToken)
      processQueue(null, nuevoToken)
      original.headers.Authorization = `Bearer ${nuevoToken}`
      return api(original)  // Reintentar la petición original
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      localStorage.clear()
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  }
)

// ── Métodos agrupados por módulo ──────────────────
// Exportar así permite importar solo lo necesario:
// import { transactionsAPI } from '../api/client'

export const authAPI = {
  register: d    => api.post('/auth/register', d),
  login:    d    => api.post('/auth/login', d),
  logout:   ()   => api.post('/auth/logout'),
  me:       ()   => api.get('/auth/me'),
}

export const transactionsAPI = {
  list:   params => api.get('/transactions', { params }),
  create: d      => api.post('/transactions', d),
  update: (id,d) => api.put(`/transactions/${id}`, d),
  remove: id     => api.delete(`/transactions/${id}`),
}

export const accountsAPI = {
  list:   ()     => api.get('/accounts'),
  create: d      => api.post('/accounts', d),
  update: (id,d) => api.put(`/accounts/${id}`, d),
  remove: id     => api.delete(`/accounts/${id}`),
}

export const debtsAPI = {
  list:       ()     => api.get('/debts'),
  create:     d      => api.post('/debts', d),
  update:     (id,d) => api.put(`/debts/${id}`, d),
  remove:     id     => api.delete(`/debts/${id}`),
  projection: id     => api.get(`/debts/${id}/projection`),
}

export const categoriesAPI = {
  list:   ()     => api.get('/categories'),
  create: d      => api.post('/categories', d),
  update: (id,d) => api.put(`/categories/${id}`, d),
  remove: id     => api.delete(`/categories/${id}`),
}

export const analyticsAPI = {
  summary:    params => api.get('/analytics/summary',      { params }),
  byCategory: params => api.get('/analytics/by-category', { params }),
  projection: params => api.get('/analytics/projection',  { params }),
  netWorth:   ()     => api.get('/analytics/net-worth'),
  cashFlow:   params => api.get('/analytics/cash-flow',   { params }),
}

export default api