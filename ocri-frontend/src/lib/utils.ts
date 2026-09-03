import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Devuelve la última parte de una ruta (basename). Si `value` es null/undefined
 * o vacío, devuelve `fallback`. Útil para mostrar el nombre legible de un
 * documento cuyo `original_name` o `file_path` puede contener subcarpetas
 * (p. ej. "2026/001-2O23/expediente-tecnico.pdf" -> "expediente-tecnico.pdf").
 */
export function fileName(
  value: string | null | undefined,
  fallback = "",
): string {
  if (!value) return fallback;
  const base = value.split("/").pop()?.split("\\").pop() || value;
  return base || fallback;
}
