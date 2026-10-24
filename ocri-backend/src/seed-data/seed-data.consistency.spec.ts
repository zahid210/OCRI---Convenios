import * as fs from 'fs';
import * as path from 'path';
import { AGREEMENT_TYPES, DOCUMENT_TYPES } from '../catalogs/catalogs.data';

// -----------------------------------------------------------------------------
// Guardia de integridad del seed versionado (prisma/seed-data/*.json), que
// sustituye al dump SQL del primer arranque. No usa la base: solo comprueba que
// los datos sean coherentes entre sí, de modo que una edición no introduzca
// referencias rotas (documento sin convenio, convenio sin institución, tipo de
// documento/convenio inexistente, ids duplicados...).
// -----------------------------------------------------------------------------

interface Row {
  [key: string]: string | number | null;
}

function findDir(candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('No se encontró prisma/seed-data (use OCRI_SEED_DIR).');
}

const DIR = findDir([
  process.env.OCRI_SEED_DIR,
  path.resolve(process.cwd(), 'prisma', 'seed-data'),
  path.resolve(process.cwd(), 'ocri-backend', 'prisma', 'seed-data'),
  '/app/prisma/seed-data',
]);

function read(name: string): Row[] {
  return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8')) as Row[];
}

const institutions = read('institutions.json');
const agreements = read('agreements.json');
const documents = read('documents.json');

const ids = (rows: Row[]): Set<number> =>
  new Set(rows.map((r) => Number(r.id)));

describe('Seed de datos históricos', () => {
  it('tiene los conteos esperados', () => {
    expect(institutions).toHaveLength(388);
    expect(agreements).toHaveLength(447);
    expect(documents).toHaveLength(436);
  });

  it('no repite ids dentro de cada tabla', () => {
    for (const rows of [institutions, agreements, documents]) {
      const list = rows.map((r) => Number(r.id));
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('cada convenio referencia una institución y un tipo de convenio válidos', () => {
    const ok = ids(institutions);
    const tipos = new Set(AGREEMENT_TYPES);
    for (const a of agreements) {
      expect(ok.has(Number(a.institution_id))).toBe(true);
      expect(tipos.has(String(a.agreement_type))).toBe(true);
    }
  });

  it('cada documento referencia un convenio y un tipo de documento válidos', () => {
    const ok = ids(agreements);
    const tipos = new Set(DOCUMENT_TYPES.map((t) => t.code));
    for (const d of documents) {
      expect(ok.has(Number(d.agreement_id))).toBe(true);
      expect(tipos.has(String(d.document_type))).toBe(true);
    }
  });
});
