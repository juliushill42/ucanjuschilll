'use client'

import * as RadixToast from '@radix-ui/react-toast'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { create } from 'zustand'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastStore = {
  toasts: Toast[]
  add: (message: string, type?: ToastType) => void
  remove: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  remove: (id) => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}))

const ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const STYLES: Record<ToastType, string> = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  info: 'border-brand-500/30 bg-brand-500/10 text-brand-400',
}

export function Toaster() {
  const { toasts, remove } = useToast()

  return (
    <RadixToast.Provider swipeDirection="right">
      {toasts.map(toast => {
        const Icon = ICONS[toast.type]
        return (
          <RadixToast.Root
            key={toast.id}
            className={cn(
              'glass rounded-xl border px-4 py-3 flex items-center gap-3 shadow-lg',
              'animate-slide-up',
              STYLES[toast.type]
            )}
            open={true}
            onOpenChange={(open) => { if (!open) remove(toast.id) }}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <RadixToast.Description className="text-sm text-white/90 flex-1">
              {toast.message}
            </RadixToast.Description>
            <RadixToast.Close asChild>
              <button
                onClick={() => remove(toast.id)}
                className="text-white/30 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </RadixToast.Close>
          </RadixToast.Root>
        )
      })}
      <RadixToast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-80 z-50 outline-none" />
    </RadixToast.Provider>
  )
}
