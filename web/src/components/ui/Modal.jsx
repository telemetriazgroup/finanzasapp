import { X } from 'lucide-react'
import { useEffect } from 'react'

// size: 'sm' | 'md' | 'lg'
export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const anchos = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo oscuro — clic cierra el modal */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Contenedor del modal */}
      <div className={`
        relative bg-white rounded-2xl shadow-xl w-full ${anchos[size]}
        max-h-[90vh] overflow-y-auto
      `}>
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Contenido */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}