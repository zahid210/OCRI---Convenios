"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

interface PagePaginationProps {
  page: number;
  totalPages: number;
  perPage?: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  /** Oculta el selector de "mostrar por página" (útil si el paginado es del servidor). */
  showPerPage?: boolean;
  className?: string;
}

/**
 * Barra de paginación compartida por las páginas de listado (convenios,
 * propuestas, registro, etc.) para evitar duplicar el mismo bloque de UI.
 */
export function PagePagination({
  page,
  totalPages,
  perPage,
  onPageChange,
  onPerPageChange,
  showPerPage = true,
  className,
}: PagePaginationProps) {
  return (
    <div
      className={`px-12 py-4 bg-surface border-t border-gray-200 ${className ?? ""}`}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          {showPerPage && onPerPageChange && perPage != null && (
            <>
              <span>Mostrar</span>
              <div className="relative">
                <select
                  value={perPage}
                  onChange={(e) => {
                    onPerPageChange(Number(e.target.value));
                    onPageChange(1);
                  }}
                  className="appearance-none w-full bg-white border border-gray-300 pl-3 pr-10 py-1 text-xs focus:outline-none focus:border-gold"
                >
                  {[10, 15, 25, 50, 100].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-4 w-4 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <span>por página</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>
            Página{" "}
            <strong className="font-semibold text-gray-800">{page}</strong> de{" "}
            <strong className="font-semibold text-gray-800">
              {totalPages}
            </strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(page - 1, 1))}
              className="p-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(page + 1, totalPages))}
              className="p-1.5 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
