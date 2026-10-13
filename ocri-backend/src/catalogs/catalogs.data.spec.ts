import {
  AGREEMENT_TYPES,
  APP_CONFIG_DEFAULTS,
  DOCUMENT_TYPES,
} from './catalogs.data';
import { DEPENDENCIAS_SEED } from '../dependencias/dependencias.data';

// -----------------------------------------------------------------------------
// Los catálogos son la fuente única que siembran la app (POST /catalogs/seed) y
// scripts/seed-catalogs.ts. Estos tests evitan que una edición introduzca
// códigos duplicados/ inválidos o rompa el conteo esperado de cada catálogo.
// -----------------------------------------------------------------------------

const DIRECTIONS = ['ENTRADA', 'SALIDA', 'INTERNO'];
const KINDS = ['RECTORADO', 'OCRI', 'UNIDAD_ORGANICA'];

describe('Catálogos canónicos', () => {
  it('tipos de documento: 20, códigos únicos y dirección válida', () => {
    expect(DOCUMENT_TYPES).toHaveLength(20);
    const codes = DOCUMENT_TYPES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const t of DOCUMENT_TYPES) {
      expect(t.code).toMatch(/^[A-Z0-9_]+$/);
      expect(DIRECTIONS).toContain(t.direction);
      expect(t.name.trim().length).toBeGreaterThan(0);
    }
    // Los oficios de seguimiento son los que faltaban en el seed antiguo.
    expect(codes).toEqual(
      expect.arrayContaining([
        'SOLICITUD_PLAN_TRABAJO',
        'SOLICITUD_INFORME_SEMESTRAL',
        'SOLICITUD_INFORME_FINAL',
        'PROPUESTA_CONVENIO_FIRMA',
        'DICTAMEN',
        'DOCUMENTO_DE_ORIGEN',
      ]),
    );
  });

  it('dependencias: 66, códigos únicos, kind válido y un solo RECTORADO/OCRI', () => {
    expect(DEPENDENCIAS_SEED).toHaveLength(66);
    const codes = DEPENDENCIAS_SEED.map((d) => d.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const d of DEPENDENCIAS_SEED) {
      expect(KINDS).toContain(d.kind);
      expect(typeof d.is_default_opinion).toBe('boolean');
      expect(typeof d.sort_order).toBe('number');
    }
    expect(codes.filter((c) => c === 'RECTORADO')).toHaveLength(1);
    expect(codes.filter((c) => c === 'OCRI')).toHaveLength(1);
    // Códigos heredados que el script obsoleto introducía por error:
    expect(codes).not.toContain('VRIE');
    expect(codes).not.toContain('ASEL');
    expect(codes).not.toContain('REC');
  });

  it('tipos de convenio: 4 nombres únicos', () => {
    expect(AGREEMENT_TYPES).toHaveLength(4);
    expect(new Set(AGREEMENT_TYPES).size).toBe(AGREEMENT_TYPES.length);
  });

  it('app_config: claves únicas', () => {
    const keys = APP_CONFIG_DEFAULTS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
