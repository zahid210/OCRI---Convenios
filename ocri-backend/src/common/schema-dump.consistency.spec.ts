import * as fs from 'fs';
import * as path from 'path';
import {
  AGREEMENT_TYPES,
  APP_CONFIG_DEFAULTS,
  DOCUMENT_TYPES,
} from '../catalogs/catalogs.data';
import { DEPENDENCIAS_SEED } from '../dependencias/dependencias.data';

// -----------------------------------------------------------------------------
// Guardia anti-drift: la base que crea dumps/ocri-inicio.sql en el primer
// arranque debe coincidir con prisma/schema.prisma. Este test habría atrapado
// el 500 de "Solicitud Aceptada" (enum deliverables.status sin ACEPTADO) y el
// fallo de import del dump (REPLACE INTO users con menos valores que columnas).
//
// No usa la base: parsea texto. Se ejecuta con `npm test` (cwd = ocri-backend).
// Rutas configurables con OCRI_DUMP_PATH / OCRI_SCHEMA_PATH.
// -----------------------------------------------------------------------------

function findFile(candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(
    'No se encontró el archivo. Rutas probadas:\n' +
      candidates.filter(Boolean).join('\n'),
  );
}

const dumpPath = findFile([
  process.env.OCRI_DUMP_PATH,
  path.resolve(process.cwd(), '..', 'dumps', 'ocri-inicio.sql'),
  path.resolve(process.cwd(), 'dumps', 'ocri-inicio.sql'),
  '/dumps/ocri-inicio.sql',
]);
const schemaPath = findFile([
  process.env.OCRI_SCHEMA_PATH,
  path.resolve(process.cwd(), 'prisma', 'schema.prisma'),
  path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'),
]);

const SCALARS = new Set([
  'String',
  'Int',
  'BigInt',
  'Boolean',
  'DateTime',
  'Float',
  'Decimal',
  'Json',
  'Bytes',
]);

interface PrismaField {
  name: string;
  column: string;
  baseType: string;
}
interface PrismaModel {
  name: string;
  table: string;
  fields: PrismaField[];
}

function parsePrisma(schema: string): {
  enums: Map<string, string[]>;
  models: PrismaModel[];
  modelNames: Set<string>;
} {
  const enums = new Map<string, string[]>();
  let m: RegExpExecArray | null;
  const enumRe = /enum\s+(\w+)\s*\{([\s\S]*?)\}/g;
  while ((m = enumRe.exec(schema))) {
    const values = m[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => l && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0]);
    enums.set(m[1], values);
  }

  const raw: Array<{ name: string; body: string }> = [];
  const modelNames = new Set<string>();
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  while ((m = modelRe.exec(schema))) {
    raw.push({ name: m[1], body: m[2] });
    modelNames.add(m[1]);
  }

  const models: PrismaModel[] = raw.map(({ name, body }) => {
    const mapMatch = body.match(/@@map\("(\w+)"\)/);
    const fields: PrismaField[] = [];
    for (const line of body.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('@@') || t.startsWith('//')) continue;
      const fm = t.match(/^(\w+)\s+([\w.]+)(\[\])?(\?)?/);
      if (!fm) continue;
      const base = fm[2].split('.').pop() as string;
      const colMatch = t.match(/@map\("(\w+)"\)/);
      fields.push({
        name: fm[1],
        column: colMatch ? colMatch[1] : fm[1],
        baseType: base,
      });
    }
    return { name, table: mapMatch ? mapMatch[1] : name, fields };
  });

  return { enums, models, modelNames };
}

interface DumpColumn {
  enumValues: string[] | null;
}

function parseDumpEnumValues(columnType: string): string[] | null {
  const m = columnType.match(/enum\((.*)\)/);
  if (!m) return null;
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
}

function parseDumpTables(sql: string): Map<string, Map<string, DumpColumn>> {
  const tables = new Map<string, Map<string, DumpColumn>>();
  const createRe = /CREATE TABLE `(\w+)` \(([\s\S]*?)\n\) ENGINE/g;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql))) {
    const cols = new Map<string, DumpColumn>();
    for (const line of m[2].split('\n')) {
      const cm = line.trim().match(/^`(\w+)`\s+(.*)$/);
      if (!cm) continue; // PRIMARY KEY / UNIQUE KEY / KEY ...
      cols.set(cm[1], { enumValues: parseDumpEnumValues(cm[2]) });
    }
    tables.set(m[1], cols);
  }
  return tables;
}

/** Salta hasta el `;` de cierre respetando comillas simples y escapes. */
function scanToSemicolon(s: string, start: number): number {
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === "'") {
        if (s[i + 1] === "'") {
          i++;
          continue;
        }
        inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      continue;
    }
    if (ch === ';') return i;
  }
  return -1;
}

/** Separa una tupla `a, b, c` en top-level respetando comillas y paréntesis. */
function splitTopLevelCommas(inner: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      cur += ch;
      if (ch === '\\') {
        cur += inner[++i] ?? '';
        continue;
      }
      if (ch === "'") {
        if (inner[i + 1] === "'") {
          cur += inner[++i];
          continue;
        }
        inStr = false;
      }
      continue;
    }
    if (ch === "'") {
      inStr = true;
      cur += ch;
      continue;
    }
    if (ch === '(') {
      depth++;
      cur += ch;
      continue;
    }
    if (ch === ')') {
      depth--;
      cur += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length) out.push(cur.trim());
  return out;
}

function parseReplaceTuples(blob: string): string[][] {
  const tuples: string[][] = [];
  let i = 0;
  while (i < blob.length) {
    while (i < blob.length && (blob[i] === ',' || /\s/.test(blob[i]))) i++;
    if (i >= blob.length) break;
    if (blob[i] !== '(') {
      throw new Error(`Se esperaba "(" en VALUES: ${blob.slice(i, i + 40)}`);
    }
    let depth = 0;
    let inStr = false;
    const start = i + 1;
    let j = i;
    for (; j < blob.length; j++) {
      const ch = blob[j];
      if (inStr) {
        if (ch === '\\') {
          j++;
          continue;
        }
        if (ch === "'") {
          if (blob[j + 1] === "'") {
            j++;
            continue;
          }
          inStr = false;
        }
        continue;
      }
      if (ch === "'") {
        inStr = true;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    tuples.push(splitTopLevelCommas(blob.slice(start, j)));
    i = j + 1;
  }
  return tuples;
}

/** Tuplas de cada `REPLACE INTO \`tabla\`` indexadas por tabla. */
function replaceTuplesByTable(sql: string): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  const repRe = /REPLACE INTO `(\w+)`\s+VALUES\s+/g;
  let m: RegExpExecArray | null;
  while ((m = repRe.exec(sql))) {
    const end = scanToSemicolon(sql, repRe.lastIndex);
    if (end < 0) continue;
    out.set(m[1], parseReplaceTuples(sql.slice(repRe.lastIndex, end)));
    repRe.lastIndex = end + 1;
  }
  return out;
}

/** Quita las comillas de un literal del dump; `NULL` → null. */
function unq(value: string): string | null {
  const t = value.trim();
  if (t === 'NULL') return null;
  if (t.startsWith("'") && t.endsWith("'")) {
    return t
      .slice(1, -1)
      .replace(/''/g, "'")
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }
  return t;
}

/** Filas de una tabla como objetos columna→valor (orden del CREATE TABLE). */
function dumpRows(
  sql: string,
  allTables: Map<string, Map<string, DumpColumn>>,
  table: string,
): Array<Record<string, string | null>> {
  const cols = [...(allTables.get(table)?.keys() ?? [])];
  const tuples = replaceTuplesByTable(sql).get(table) ?? [];
  return tuples.map((t) =>
    Object.fromEntries(cols.map((c, i) => [c, unq(t[i] ?? '')])),
  );
}

// Se quitan los comentarios de línea completa (`-- …`): aparecen entre el
// `VALUES` y las tuplas (p. ej. en `users`) y romperían el parser de aridad.
const dump = fs
  .readFileSync(dumpPath, 'utf8')
  .split('\n')
  .filter((l) => !/^\s*--/.test(l))
  .join('\n');
const schema = fs.readFileSync(schemaPath, 'utf8');
const { enums, models, modelNames } = parsePrisma(schema);
const tables = parseDumpTables(dump);

describe('Consistencia dump ↔ schema.prisma', () => {
  it('cada modelo Prisma tiene su tabla y todas sus columnas escalares en el dump', () => {
    const missing: string[] = [];
    for (const model of models) {
      const cols = tables.get(model.table);
      if (!cols) {
        missing.push(
          `tabla \`${model.table}\` (modelo ${model.name}) ausente en el dump`,
        );
        continue;
      }
      for (const f of model.fields) {
        if (modelNames.has(f.baseType)) continue; // relación, no es columna
        if (!SCALARS.has(f.baseType) && !enums.has(f.baseType)) continue;
        if (!cols.has(f.column)) {
          missing.push(`${model.table}.${f.column} (campo ${f.name})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('los valores de cada enum coinciden entre Prisma y el dump', () => {
    const mismatches: string[] = [];
    for (const model of models) {
      const cols = tables.get(model.table);
      if (!cols) continue;
      for (const f of model.fields) {
        const prismaValues = enums.get(f.baseType);
        if (!prismaValues) continue;
        const dumpCol = cols.get(f.column);
        if (!dumpCol || !dumpCol.enumValues) {
          mismatches.push(
            `${model.table}.${f.column}: Prisma ${f.baseType} pero el dump no declara enum`,
          );
          continue;
        }
        const a = [...prismaValues].sort().join('|');
        const b = [...dumpCol.enumValues].sort().join('|');
        if (a !== b) {
          mismatches.push(
            `${model.table}.${f.column} (${f.baseType}): Prisma=[${a}] dump=[${b}]`,
          );
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('cada REPLACE INTO trae tantos valores como columnas tiene su tabla', () => {
    const problems: string[] = [];
    const repRe = /REPLACE INTO `(\w+)`\s+VALUES\s+/g;
    let m: RegExpExecArray | null;
    while ((m = repRe.exec(dump))) {
      const table = m[1];
      const cols = tables.get(table);
      if (!cols) {
        problems.push(
          `REPLACE INTO \`${table}\`: tabla sin CREATE TABLE en el dump`,
        );
        continue;
      }
      const end = scanToSemicolon(dump, repRe.lastIndex);
      if (end < 0) {
        problems.push(`REPLACE INTO \`${table}\`: sin ; de cierre`);
        continue;
      }
      const blob = dump.slice(repRe.lastIndex, end);
      let tuples: string[][];
      try {
        tuples = parseReplaceTuples(blob);
      } catch (e) {
        problems.push(`REPLACE INTO \`${table}\`: ${(e as Error).message}`);
        continue;
      }
      tuples.forEach((t, idx) => {
        if (t.length !== cols.size) {
          problems.push(
            `\`${table}\` fila #${idx + 1}: ${t.length} valores vs ${cols.size} columnas`,
          );
        }
      });
      repRe.lastIndex = end + 1;
    }
    expect(problems).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Los catálogos canónicos (los que siembran la app y el script) deben coincidir
// con las filas del dump, que es lo que la base tendrá tras el primer arranque.
// Así el seed y la BD no pueden divergir (antes había tres listas distintas de
// tipos de documento y dos de dependencias).
// -----------------------------------------------------------------------------
describe('Catálogos canónicos ↔ dump', () => {
  it('document_types coincide en código, nombre y dirección', () => {
    const rows = dumpRows(dump, tables, 'document_types');
    expect(rows).toHaveLength(DOCUMENT_TYPES.length);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const problems: string[] = [];
    for (const t of DOCUMENT_TYPES) {
      const r = byCode.get(t.code);
      if (!r) problems.push(`falta ${t.code}`);
      else if (r.name !== t.name || r.direction !== t.direction) {
        problems.push(
          `${t.code}: dump=${String(r.name)}/${String(r.direction)} ` +
            `seed=${t.name}/${t.direction}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it('dependencias coincide en código, nombre, kind y opinión por defecto', () => {
    const rows = dumpRows(dump, tables, 'dependencias');
    expect(rows).toHaveLength(DEPENDENCIAS_SEED.length);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const problems: string[] = [];
    for (const d of DEPENDENCIAS_SEED) {
      const r = byCode.get(d.code);
      if (!r) {
        problems.push(`falta ${d.code}`);
        continue;
      }
      const dumpOpinion = r.is_default_opinion === '1';
      if (
        r.name !== d.name ||
        r.kind !== d.kind ||
        dumpOpinion !== d.is_default_opinion
      ) {
        problems.push(
          `${d.code}: dump=${String(r.name)}/${String(r.kind)}/${String(r.is_default_opinion)} ` +
            `seed=${d.name}/${d.kind}/${String(d.is_default_opinion)}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });

  it('agreement_types coincide por nombre', () => {
    const names = dumpRows(dump, tables, 'agreement_types').map((r) => r.name);
    expect([...names].sort()).toEqual([...AGREEMENT_TYPES].sort());
  });

  it('app_config coincide en clave y valor', () => {
    const rows = dumpRows(dump, tables, 'app_config');
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const problems: string[] = [];
    for (const c of APP_CONFIG_DEFAULTS) {
      if (!byKey.has(c.key)) problems.push(`falta ${c.key}`);
      else if (byKey.get(c.key) !== c.value) {
        problems.push(
          `${c.key}: dump=${String(byKey.get(c.key))} seed=${c.value}`,
        );
      }
    }
    expect(problems).toEqual([]);
  });
});
