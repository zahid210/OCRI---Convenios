"use client"

import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, CircleAlert, Info, TriangleAlert, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "warning" | "info"

type ToastOptions = {
  description?: React.ReactNode
  timeout?: number
}

type ToastContextValue = {
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  warning: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

function useToastContext() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.")
  }
  return context
}

const VARIANT_STYLE: Record<ToastVariant, { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; rootClass: string }> = {
  success: { icon: CheckCircle2, rootClass: "bg-[#0b6e4f]" },
  error: { icon: CircleAlert, rootClass: "bg-red-600" },
  warning: { icon: TriangleAlert, rootClass: "bg-[#df9f1f]" },
  info: { icon: Info, rootClass: "bg-sky-600" },
}

function ToastViewport() {
  const { toasts, close } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="pointer-events-none fixed right-0 bottom-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm">
        {toasts.map((toast) => {
          const variant = (toast.type as ToastVariant) || "info"
          const { icon: Icon, rootClass } = VARIANT_STYLE[variant] || VARIANT_STYLE.info
          return (
            <Toast.Root
              key={toast.id}
              toast={toast}
              swipeDirection={[]}
              className={cn(
                "pointer-events-auto w-full px-4 py-3 text-white shadow-xl",
                "transition duration-200 ease-in-out",
                "data-starting-style:translate-x-4 data-starting-style:opacity-0 data-ending-style:translate-x-4 data-ending-style:opacity-0",
                rootClass
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <Toast.Title className="text-sm leading-snug font-medium break-words">
                    {toast.title}
                  </Toast.Title>
                  {toast.description && (
                    <Toast.Description className="mt-0.5 text-sm leading-snug break-words text-white/90">
                      {toast.description}
                    </Toast.Description>
                  )}
                </div>
                <Toast.Close
                  onClick={() => close(toast.id)}
                  aria-label="Cerrar notificación"
                  className="shrink-0 cursor-pointer rounded-sm p-0.5 text-white/80 transition-colors hover:bg-black/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                >
                  <XIcon className="size-4" />
                </Toast.Close>
              </div>
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

function ToastBridge({ children }: { children: React.ReactNode }) {
  const manager = Toast.useToastManager()

  const value = React.useMemo<ToastContextValue>(
    () => ({
      success: (message, options) =>
        manager.add({ type: "success", title: message, ...options, priority: "low" }),
      error: (message, options) =>
        manager.add({ type: "error", title: message, ...options, priority: "high" }),
      warning: (message, options) =>
        manager.add({ type: "warning", title: message, ...options, priority: "low" }),
      info: (message, options) =>
        manager.add({ type: "info", title: message, ...options, priority: "low" }),
    }),
    [manager]
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={5000} limit={3}>
      <ToastViewport />
      <ToastBridge>{children}</ToastBridge>
    </Toast.Provider>
  )
}

export { ToastProvider, useToastContext as useToast }
