"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerId: string;
  contentId: string;
}

const DropdownMenuContext = React.createContext<
  DropdownMenuContextType | undefined
>(undefined);

function useDropdown(id: string) {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error(`${id} must be used within DropdownMenu`);
  return ctx;
}

function useAutoId(prefix: string) {
  const id = React.useId();
  return `${prefix}-${id.replace(/:/g, "")}`;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerId = useAutoId("ocri-dd-trigger");
  const contentId = useAutoId("ocri-dd-content");

  // Cierra con clic fuera o con Escape.
  React.useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handlePointer);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Mueve el foco al primer item al abrir (patrón menu button de WAI-ARIA).
  React.useEffect(() => {
    if (open) {
      const firstItem = contentRef.current?.querySelector(
        '[role="menuitem"]',
      ) as HTMLElement | null;
      requestAnimationFrame(() => {
        // Solo roba el foco si el foco actual no está dentro ya del contenido.
        const active = document.activeElement;
        const inside = contentRef.current?.contains(active);
        if (!inside) firstItem?.focus();
      });
    }
  }, [open]);

  const keyboardNavigate = (event: React.KeyboardEvent, dir: 1 | -1) => {
    event.preventDefault();
    const items = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        [],
    );
    const currentIndex = items.findIndex((el) => el === document.activeElement);
    if (items.length === 0) return;
    const next =
      currentIndex === -1
        ? dir === 1
          ? 0
          : items.length - 1
        : (currentIndex + dir + items.length) % items.length;
    items[next].focus();
  };

  return (
    <DropdownMenuContext.Provider
      value={{ open, setOpen, triggerId, contentId }}
    >
      <div className="relative inline-block text-left" ref={containerRef}>
        {/* Al cerrar por Escape devolvemos el foco al trigger */}
        <FocusReturn open={open} triggerId={triggerId} />
        <div
          className="contents"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown" && open) keyboardNavigate(e, 1);
            else if (e.key === "ArrowUp" && open) keyboardNavigate(e, -1);
          }}
        >
          {children}
        </div>
      </div>
    </DropdownMenuContext.Provider>
  );
}

function FocusReturn({
  open,
  triggerId,
}: {
  open: boolean;
  triggerId: string;
}) {
  const lastFocused = React.useRef<string | null>(null);
  React.useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    if (open) lastFocused.current = active?.id ?? null;
    else if (lastFocused.current) {
      document.getElementById(lastFocused.current)?.focus();
      lastFocused.current = null;
    }
  }, [open, triggerId]);
  return null;
}

export function DropdownMenuTrigger({
  children,
  className,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "role">) {
  const ctx = useDropdown("DropdownMenuTrigger");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      aria-controls={ctx.contentId}
      id={ctx.triggerId}
      onClick={() => ctx.setOpen(!ctx.open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          ctx.setOpen(!ctx.open);
        }
      }}
      className={cn(
        "cursor-pointer select-none focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}) {
  const ctx = useDropdown("DropdownMenuContent");
  if (!ctx.open) return null;

  return (
    <div
      id={ctx.contentId}
      role="menu"
      aria-labelledby={ctx.triggerId}
      className={cn(
        "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-1.5 text-slate-100 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className,
  onClick,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "role" | "tabIndex"> & {
  onClick?: () => void;
}) {
  const ctx = useDropdown("DropdownMenuItem");

  const activate = () => {
    onClick?.();
    ctx.setOpen(false);
  };

  return (
    <div
      role="menuitem"
      tabIndex={-1}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-3 py-2 text-xs font-semibold text-slate-400",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-slate-800", className)} />;
}

export function DropdownMenuGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5">{children}</div>;
}
