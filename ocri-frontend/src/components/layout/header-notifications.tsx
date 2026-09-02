"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Loader2,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import type { NotificationItem } from "@/types/agreements";

interface NotificationsResponse {
  total: number;
  items: NotificationItem[];
}

const POLL_INTERVAL_MS = 15000;

const TYPE_META: Record<
  NotificationItem["type"],
  { icon: typeof Bell; label: string; color: string; chip: string }
> = {
  expired: {
    icon: AlertTriangle,
    label: "Vencido",
    color: "text-red-600",
    chip: "border-red-200 bg-red-50 text-red-700",
  },
  expiring: {
    icon: CalendarClock,
    label: "Por vencer",
    color: "text-yellow-600",
    chip: "border-yellow-200 bg-yellow-50 text-yellow-800",
  },
  pending_area: {
    icon: ClipboardCheck,
    label: "Pendiente",
    color: "text-blue-600",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
  },
} as const;

export function HeaderNotifications() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<NotificationsResponse>("/notifications");
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las notificaciones.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchApi<NotificationsResponse>("/notifications")
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar las notificaciones.",
          );
        }
      });

    // Actualización en tiempo real (polling) para mantener el badge al día.
    const timer = setInterval(() => {
      fetchApi<NotificationsResponse>("/notifications")
        .then((res) => {
          if (!cancelled) setData(res);
        })
        .catch(() => {
          /* mantener el último estado conocido si falla el polling */
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const acknowledge = async (keys: string[]) => {
    if (keys.length === 0) return;
    setAcknowledging(true);
    // Optimista: quitar la(s) notificación(es) ya leída(s) del estado local.
    setData((prev) =>
      prev
        ? {
            total: Math.max(0, prev.total - keys.length),
            items: prev.items.filter((n) => !keys.includes(n.id)),
          }
        : prev,
    );
    try {
      await fetchApi<{ pending: number }>("/notifications/acknowledge", {
        method: "POST",
        body: JSON.stringify({ keys }),
      });
      // Re-sincroniza con el servidor para reflejar el recuento real.
      load({ silent: true });
    } catch {
      // Si falla, restaurar recargando desde el servidor.
      load({ silent: true });
    } finally {
      setAcknowledging(false);
    }
  };

  const resetRead = async () => {
    setAcknowledging(true);
    try {
      const res = await fetchApi<{ pending: number }>(
        "/notifications/reset-read",
        { method: "POST" },
      );
      setData((prev) =>
        prev ? { total: res.pending, items: prev.items } : prev,
      );
      load({ silent: true });
    } catch {
      load({ silent: true });
    } finally {
      setAcknowledging(false);
    }
  };

  const total = data?.total ?? 0;
  const badge = total > 99 ? "99+" : String(total);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load({ silent: true });
        }}
        className="relative cursor-pointer border border-transparent p-2.5 text-gray-600 transition-colors hover:text-[#0b5a41]"
        aria-label={`Notificaciones (${total})`}
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#df9f1f] px-0.5 text-[9px] font-bold text-white ring-2 ring-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-h-[70vh] overflow-y-auto border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
              Notificaciones
            </span>
            <div className="flex items-center gap-2.5">
              {total === 0 && data && !acknowledging && (
                <button
                  type="button"
                  onClick={resetRead}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-[#0b5a41]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restablecer
                </button>
              )}
              {total > 0 && (
                <span className="text-[10px] font-semibold text-[#df9f1f]">
                  {total} pendiente(s)
                </span>
              )}
              {acknowledging && (
                <Loader2 className="h-3 w-3 animate-spin text-[#0b5a41]" />
              )}
            </div>
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#df9f1f]" />
              <span>Cargando...</span>
            </div>
          ) : error ? (
            <p className="px-4 py-6 text-center text-xs text-red-600">
              {error}
            </p>
          ) : !data || data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">
              No hay notificaciones pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.items.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <li
                    key={n.id}
                    className="group flex items-start gap-2 px-4 py-2.5 hover:bg-gray-50"
                  >
                    <Link
                      href={`/convenios/${n.agreement_id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-w-0 flex-1 items-start gap-2.5"
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-gray-800">
                          {n.title || n.expediente}
                        </span>
                        <span className="block truncate text-[11px] text-gray-500">
                          {n.message}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-gray-400">
                          {n.expediente}
                          {n.fecha ? ` · ${n.fecha}` : ""}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${meta.chip}`}
                      >
                        {meta.label}
                      </span>
                    </Link>
                    <button
                      type="button"
                      title="Marcar como leída"
                      aria-label="Marcar como leída"
                      onClick={() => acknowledge([n.id])}
                      className="mt-0.5 shrink-0 rounded-none border border-[#0b5a41]/30 bg-[#0b5a41]/5 p-1 text-[#0b5a41] transition-colors hover:bg-[#0b5a41] hover:text-white"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
