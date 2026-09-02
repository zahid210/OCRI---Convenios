"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2, FileText, Building2, X } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface AgreementSearchResult {
  id: number;
  title: string;
  name: string | null;
  resolution_number: string | null;
  tramite_code: string | null;
  status: string;
  institution_name: string | null;
}

interface InstitutionSearchResult {
  id: number;
  name: string;
  country: string;
  type: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreements, setAgreements] = useState<AgreementSearchResult[]>([]);
  const [institutions, setInstitutions] = useState<InstitutionSearchResult[]>(
    [],
  );
  const [hasSearched, setHasSearched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (term: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const [a, i] = await Promise.all([
        fetchApi<AgreementSearchResult[]>(
          `/agreements/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        ),
        fetchApi<InstitutionSearchResult[]>(
          `/institutions/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        ),
      ]);
      if (controller.signal.aborted) return;
      setAgreements(a);
      setInstitutions(i);
    } catch (err) {
      if (controller.signal.aborted) return;
      setAgreements([]);
      setInstitutions([]);
      setError(err instanceof Error ? err.message : "Error al buscar.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();

    if (term.length < MIN_CHARS) return;

    debounceRef.current = setTimeout(() => {
      setOpen(true);
      runSearch(term);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

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

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const term = value.trim();
    if (term.length < MIN_CHARS) {
      if (abortRef.current) abortRef.current.abort();
      setLoading(false);
      setError(null);
      setHasSearched(false);
      setAgreements([]);
      setInstitutions([]);
      setOpen(false);
    }
  };

  const total = agreements.length + institutions.length;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= MIN_CHARS) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Buscar expedientes, convenios..."
          className="w-full h-10 pl-10 pr-9 rounded-none bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#df9f1f] focus:ring-1 focus:ring-[#df9f1f] focus:bg-white transition-all"
          aria-label="Buscar convenios e instituciones"
        />
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#df9f1f]" />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto border border-gray-200 bg-white shadow-lg">
          {error ? (
            <p className="px-4 py-3 text-xs text-red-600">{error}</p>
          ) : !loading && total === 0 && hasSearched ? (
            <p className="px-4 py-3 text-xs text-gray-500">
              Sin resultados para &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            <>
              {institutions.length > 0 && (
                <div className="py-1">
                  <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Instituciones
                  </p>
                  {institutions.map((inst) => (
                    <Link
                      key={inst.id}
                      href="/institutions"
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate font-medium">{inst.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                        {inst.country}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {agreements.length > 0 && (
                <div className="border-t border-gray-100 py-1">
                  <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Convenios
                  </p>
                  {agreements.map((a) => (
                    <Link
                      key={a.id}
                      href={`/convenios/${a.id}`}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {a.title}
                        </span>
                        <span className="block truncate text-[11px] text-gray-400">
                          {a.resolution_number || a.tramite_code
                            ? `Código: ${a.resolution_number || a.tramite_code}`
                            : null}
                          {a.resolution_number || a.tramite_code ? " · " : ""}
                          {a.institution_name || ""}
                        </span>
                      </span>
                      {a.status && (
                        <span className="ml-auto shrink-0 border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {a.status}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
