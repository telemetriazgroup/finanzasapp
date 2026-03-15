import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useUIStore } from '../../store'

const ICONOS = {
  success: <CheckCircle size={15} className="text-green-500 shrink-0" />,
  error:   <AlertCircle size={15} className="text-red-500   shrink-0" />,
  info:    <Info        size={15} className="text-blue-500  shrink-0" />,
}

export default function Toasts() {
  const toasts = useUIStore(s => s.toasts)

  return (
    // fixed + pointer-events-none permite que los toasts floten
    // sin bloquear clicks en el contenido de abajo
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="
            flex items-center gap-3
            bg-white border border-gray-100 shadow-lg
            rounded-xl px-4 py-3 min-w-72 max-w-sm
            pointer-events-auto
          "
        >
          {ICONOS[t.type] || ICONOS.info}
          <span className="text-sm text-gray-700">{t.message}</span>
        </div>
      ))}
    </div>
  )
}