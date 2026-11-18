'use client';

import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

function isoToDisplay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(display: string): string | null {
  const m = display.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) {
    return null;
  }
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    d.getUTCFullYear() !== yyyy ||
    d.getUTCMonth() !== mm - 1 ||
    d.getUTCDate() !== dd
  ) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function maskDdMmYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  className = 'w-full border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gold',
  placeholder = 'dd/mm/aaaa',
}: {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [editingText, setEditingText] = useState<string | null>(null);

  const displayValue = editingText !== null ? editingText : isoToDisplay(value);

  const handleTextChange = (raw: string) => {
    const masked = maskDdMmYyyy(raw);
    setEditingText(masked);
    if (!masked) {
      onChange('');
      return;
    }
    const iso = displayToIso(masked);
    if (iso) {
      onChange(iso);
    }
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={() => setEditingText(null)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={10}
        className={`${className} pr-9`}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Seleccionar fecha"
        className="absolute right-2.5 text-gray-400 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          setEditingText(null);
          onChange(e.target.value);
        }}
        className="sr-only"
      />
    </div>
  );
}
