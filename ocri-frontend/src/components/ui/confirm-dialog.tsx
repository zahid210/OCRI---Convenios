"use client"

import * as React from "react"
import { AlertDialog } from "@base-ui/react/alert-dialog"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null)

function useConfirmContext() {
  const context = React.useContext(ConfirmContext)
  if (!context) {
    throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>.")
  }
  return context.confirm
}

function ConfirmDialog({
  open,
  options,
  onResolve,
}: {
  open: boolean
  options: ConfirmOptions | null
  onResolve: (result: boolean) => void
}) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onResolve(false)
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[100] bg-black/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-[100] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-5 shadow-xl transition duration-150 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                options?.destructive ? "bg-red-100 text-red-600" : "bg-amber-100 text-gold"
              )}
            >
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <AlertDialog.Title className="text-base font-semibold text-gray-900">
                {options?.title}
              </AlertDialog.Title>
              {options?.description && (
                <AlertDialog.Description className="mt-1 text-sm text-gray-500">
                  {options.description}
                </AlertDialog.Description>
              )}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <AlertDialog.Close
              onClick={() => onResolve(false)}
              className="cursor-pointer border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            >
              {options?.cancelLabel ?? "Cancelar"}
            </AlertDialog.Close>
            <button
              type="button"
              onClick={() => onResolve(true)}
              className={cn(
                "cursor-pointer px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                options?.destructive ? "bg-red-600 hover:bg-red-700" : "bg-gold hover:bg-gold-dark"
              )}
            >
              {options?.confirmLabel ?? "Confirmar"}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
  const resolverRef = React.useRef<((result: boolean) => void) | null>(null)

  const resolve = React.useCallback((result: boolean) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOpen(false)
  }, [])

  const confirm = React.useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolvePromise) => {
      resolverRef.current?.(false)
      resolverRef.current = resolvePromise
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  const value = React.useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog open={open} options={options} onResolve={resolve} />
    </ConfirmContext.Provider>
  )
}

export { ConfirmProvider, useConfirmContext as useConfirm }
