"use client";

import * as React from "react";

/**
 * Fila de tabla clicable con soporte de teclado (WCAG): agrega rol, tabIndex y
 * activación con Enter/Espacio para que un <tr> con onClick sea operable por
 * teclado y anunciable por lectores de pantalla.
 */
interface ClickableTableRowProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ClickableTableRow({
  onClick,
  children,
  className,
  ariaLabel,
}: ClickableTableRowProps) {
  return (
    <tr
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid #df9f1f";
        e.currentTarget.style.outlineOffset = "-2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
      className={className}
    >
      {children}
    </tr>
  );
}
