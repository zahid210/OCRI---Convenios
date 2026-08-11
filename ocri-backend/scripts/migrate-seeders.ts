import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const AGREEMENT_TYPE_MARCO = 'Convenio Marco';
const AGREEMENT_TYPE_ESPECIFICO = 'Convenio Específico';
const AGREEMENT_TYPE_MEMORANDO = 'Memorando de Entendimiento';
const SITUATION_REGISTERED = 'REGISTRADO Y CONVALIDADO';
const DEFAULT_AREAS = [
  'Rectorado',
  'Vicerrectorado de Investigación',
  'Vicerrectorado Académico',
  'Asesoría Legal',
];

type RawRow = {
  code: string;
  institutionName: string;
  rawType: string;
  longName: string;
  startDate: string | null;
  endDate: string | null;
  country: string;
};

type SourceAgreement = RawRow & {
  year: number;
  institutionType: string;
  agreementTypeName: string;
  institutionKey: string;
  status: string;
};

type Counters = {
  found: number;
  created: number;
  alreadyExists: number;
  errors: number;
};

type Stats = {
  seeders: Record<number, number>;
  found: number;
  institutionsNew: number;
  institutionsExisting: number;
  institutionsDuplicates: number;
  institutionsProbable: Array<{ nameA: string; nameB: string }>;
  institutionsAmbiguous: Array<{ nameA: string; nameB: string }>;
  agreementsCreated: number;
  agreementsAlready: number;
  agreementsErrors: number;
  documentsAvailable: number;
  documentsImported: number;
  documentsMissing: number;
  roadmapsCreated: number;
  roadmapsSkipped: number;
  errors: string[];
  warnings: string[];
};

const SEEDER_FILES: Array<{ year: number; file: string }> = [
  { year: 2021, file: 'Convenios2021Seeder.php' },
  { year: 2022, file: 'Convenios2022Seeder.php' },
  { year: 2023, file: 'Convenios2023Seeder.php' },
  { year: 2024, file: 'Convenios2024Seeder.php' },
  { year: 2025, file: 'Convenios2025Seeder.php' },
];

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function parseSeederFile(filePath: string): RawRow[] {
  const content = stripBom(fs.readFileSync(filePath, 'utf8'));
  const block = content.match(/\$datos\s*=\s*\[([\s\S]*?)\n\s*\];/);
  if (!block) {
    throw new Error(`No se encontró el arreglo \$datos en ${filePath}`);
  }
  return parseRows(block[1]);
}

function parseRows(body: string): RawRow[] {
  const rows: RawRow[] = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    if (body[i] === '[') {
      const parsed = parseRow(body, i);
      rows.push(toRawRow(parsed.items));
      i = parsed.next;
    } else {
      i += 1;
    }
  }
  return rows;
}

function parseRow(
  body: string,
  start: number,
): { items: string[]; next: number } {
  const items: string[] = [];
  let i = start + 1;
  let current = '';
  let inQuote = false;
  const n = body.length;
  while (i < n) {
    const ch = body[i];
    if (inQuote) {
      if (ch === "'") {
        inQuote = false;
      } else {
        current += ch;
      }
      i += 1;
      continue;
    }
    if (ch === "'") {
      inQuote = true;
      i += 1;
      continue;
    }
    if (ch === ']') {
      items.push(current.trim());
      return { items, next: i + 1 };
    }
    if (ch === ',') {
      items.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  throw new Error('Arreglo PHP sin cerrar');
}

function toRawRow(items: string[]): RawRow {
  if (items.length !== 7) {
    throw new Error(
      `Fila con ${items.length} columnas (se esperaban 7): ${JSON.stringify(items)}`,
    );
  }
  return {
    code: items[0],
    institutionName: items[1],
    rawType: items[2],
    longName: items[3],
    startDate: items[4] === 'null' ? null : items[4],
    endDate: items[5] === 'null' ? null : items[5],
    country: items[6],
  };
}

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function exactKey(name: string): string {
  return name.trim().toUpperCase();
}

const PUBLIC_TYPES = ['Municipalidad', 'Sector Público', 'Gobierno Regional'];
const UNIVERSITY_AND_COMPANY_TYPES = [
  'Universidad Nacional',
  'Universidad Privada',
  'Universidad Internacional',
  'Empresa Nacional',
  'Empresa Internacional',
];

function matchType2022(rawType: string, institutionNameUpper: string): string {
  if (PUBLIC_TYPES.includes(rawType)) return 'Sector Público';
  if (rawType === 'Salud') return 'Salud';
  if (rawType === 'Institución Educativa') return 'Educación';
  if (UNIVERSITY_AND_COMPANY_TYPES.includes(rawType)) return rawType;
  if (rawType === 'Otros') {
    return institutionNameUpper.includes('COMUNIDAD')
      ? 'Comunidades'
      : 'Otros';
  }
  return 'Otros';
}

function matchType2023(rawType: string): string {
  if (PUBLIC_TYPES.includes(rawType)) return 'Sector Público';
  if (rawType === 'Salud') return 'Salud';
  if (rawType === 'Institución Educativa') return 'Educación';
  if (UNIVERSITY_AND_COMPANY_TYPES.includes(rawType)) return rawType;
  return 'Otros';
}

function matchType2024(rawType: string): string {
  if (PUBLIC_TYPES.includes(rawType)) return 'Sector Público';
  if (rawType === 'Salud') return 'Salud';
  if (rawType === 'Institución Educativa') return 'Educación';
  if (UNIVERSITY_AND_COMPANY_TYPES.includes(rawType)) return rawType;
  if (rawType === 'Comunidad Campesina' || rawType === 'Comunidad Nativa') {
    return 'Comunidades';
  }
  return 'Otros';
}

function classifyInstitutionType(
  year: number,
  rawType: string,
  institutionNameUpper: string,
): string {
  if (year === 2021 || year === 2025) return rawType;
  if (year === 2022) return matchType2022(rawType, institutionNameUpper);
  if (year === 2023) return matchType2023(rawType);
  return matchType2024(rawType);
}

function classifyAgreementType(year: number, longNameUpper: string): string {
  if (longNameUpper.includes('MEMORANDO')) return AGREEMENT_TYPE_MEMORANDO;
  const hasEspecifico =
    year === 2022 || year === 2023
      ? longNameUpper.includes('ESPECIFICO')
      : longNameUpper.includes('ESPECIFICO') ||
        longNameUpper.includes('ESPECÍFICO');
  const hasAdenda = year <= 2023 && longNameUpper.includes('ADENDA');
  const hasContrato = year <= 2022 && longNameUpper.includes('CONTRATO');
  if (hasEspecifico || hasAdenda || hasContrato) {
    return AGREEMENT_TYPE_ESPECIFICO;
  }
  return AGREEMENT_TYPE_MARCO;
}

function deriveStatus(endDate: string | null): string {
  if (!endDate) return 'Vigente';
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (end < now) return 'Vencido';
  return 'Vigente';
}

function buildSourceAgreements(): SourceAgreement[] {
  const agreements: SourceAgreement[] = [];
  const seen: Map<string, boolean> = new Map();
  for (const entry of SEEDER_FILES) {
    const filePath = path.join(resolveSeedersDir(), entry.file);
    const rows = parseSeederFile(filePath);
    for (const row of rows) {
      const year = entry.year;
      const institutionNameUpper = row.institutionName.trim().toUpperCase();
      const longNameUpper = row.longName.trim().toUpperCase();
      const institutionType = classifyInstitutionType(
        year,
        row.rawType,
        institutionNameUpper,
      );
      const agreementTypeName = classifyAgreementType(year, longNameUpper);
      if (seen.has(row.code)) {
        throw new Error(`Código duplicado en los seeders: ${row.code}`);
      }
      seen.set(row.code, true);
      agreements.push({
        ...row,
        institutionName: institutionNameUpper,
        longName: row.longName.trim(),
        year,
        institutionType,
        agreementTypeName,
        institutionKey: exactKey(institutionNameUpper),
        status: deriveStatus(row.endDate),
      });
    }
  }
  return agreements;
}

function resolveSeedersDir(): string {
  const args = process.argv.slice(2);
  const dirArg = args.find((a) => a.startsWith('--seeders-dir='));
  if (dirArg) {
    return path.resolve(dirArg.split('=')[1]);
  }
  return path.resolve(__dirname, '..', '..');
}

type CanonicalInstitution = {
  key: string;
  name: string;
  country: string;
  type: string;
};

function buildInstitutions(
  agreements: SourceAgreement[],
): { canonicals: CanonicalInstitution[]; duplicates: number } {
  const byKey: Map<string, CanonicalInstitution> = new Map();
  let duplicates = 0;
  for (const agreement of agreements) {
    const key = agreement.institutionKey;
    if (byKey.has(key)) {
      duplicates += 1;
      continue;
    }
    byKey.set(key, {
      key,
      name: agreement.institutionName,
      country: agreement.country.trim(),
      type: agreement.institutionType,
    });
  }
  return { canonicals: Array.from(byKey.values()), duplicates };
}

function detectRelations(
  canonicals: CanonicalInstitution[],
): {
  probable: Array<{ nameA: string; nameB: string }>;
  ambiguous: Array<{ nameA: string; nameB: string }>;
} {
  const probable: Array<{ nameA: string; nameB: string }> = [];
  const ambiguous: Array<{ nameA: string; nameB: string }> = [];
  const byAccent: Map<string, CanonicalInstitution[]> = new Map();
  for (const inst of canonicals) {
    const accentKey = stripAccents(inst.name);
    const list = byAccent.get(accentKey) ?? [];
    list.push(inst);
    byAccent.set(accentKey, list);
  }
  for (const list of byAccent.values()) {
    if (list.length > 1) {
      for (let i = 1; i < list.length; i += 1) {
        probable.push({ nameA: list[0].name, nameB: list[i].name });
      }
    }
  }
  const seenPairs: Set<string> = new Set();
  for (const inst of canonicals) {
    const accentKey = stripAccents(inst.name);
    for (const other of canonicals) {
      if (other === inst) continue;
      const otherAccent = stripAccents(other.name);
      if (otherAccent.length <= accentKey.length) continue;
      const escaped = accentKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundaryPattern = new RegExp(`(^|\\s)${escaped}($|\\s)`);
      if (boundaryPattern.test(otherAccent)) {
        const pairKey = [inst.key, other.key].sort().join('||');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          ambiguous.push({ nameA: inst.name, nameB: other.name });
        }
      }
    }
  }
  return { probable, ambiguous };
}

async function collectExisting(
  prisma: PrismaClient,
  agreements: SourceAgreement[],
  canonicals: CanonicalInstitution[],
): Promise<{
  existingAgreements: Set<string>;
  existingInstitutions: Set<string>;
}> {
  const codes = agreements.map((a) => a.code);
  const names = canonicals.map((c) => c.name);
  const existingAgreements = new Set<string>();
  const existingInstitutions = new Set<string>();
  const [agRows, instRows] = await Promise.all([
    prisma.agreements.findMany({
      where: { resolution_number: { in: codes } },
      select: { resolution_number: true },
    }),
    prisma.institutions.findMany({
      where: { name: { in: names } },
      select: { name: true },
    }),
  ]);
  for (const row of agRows) {
    if (row.resolution_number) {
      existingAgreements.add(row.resolution_number);
    }
  }
  for (const row of instRows) {
    existingInstitutions.add(row.name);
  }
  return { existingAgreements, existingInstitutions };
}

function printHeader(title: string): void {
  console.log('');
  console.log('='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function logAgreement(
  year: number,
  code: string,
  action: string,
  detail?: string,
): void {
  const base = `[${year}] ${code} → ${action}`;
  console.log(detail ? `${base} (${detail})` : base);
}

async function run() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isVerify = args.includes('--verify');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida en el archivo .env');
  }
  const adapter = new PrismaMariaDb(connectionString);
  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  const stats: Stats = {
    seeders: { 2021: 0, 2022: 0, 2023: 0, 2024: 0, 2025: 0 },
    found: 0,
    institutionsNew: 0,
    institutionsExisting: 0,
    institutionsDuplicates: 0,
    institutionsProbable: [],
    institutionsAmbiguous: [],
    agreementsCreated: 0,
    agreementsAlready: 0,
    agreementsErrors: 0,
    documentsAvailable: 0,
    documentsImported: 0,
    documentsMissing: 0,
    roadmapsCreated: 0,
    roadmapsSkipped: 0,
    errors: [],
    warnings: [],
  };

  const countersPerYear: Record<number, Counters> = {
    2021: { found: 0, created: 0, alreadyExists: 0, errors: 0 },
    2022: { found: 0, created: 0, alreadyExists: 0, errors: 0 },
    2023: { found: 0, created: 0, alreadyExists: 0, errors: 0 },
    2024: { found: 0, created: 0, alreadyExists: 0, errors: 0 },
    2025: { found: 0, created: 0, alreadyExists: 0, errors: 0 },
  };

  try {
    let agreements: SourceAgreement[];
    try {
      agreements = buildSourceAgreements();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FASE DE LECTURA FALLIDA: ${message}`);
      return;
    }

    for (const agreement of agreements) {
      stats.seeders[agreement.year] += 1;
      stats.found += 1;
      countersPerYear[agreement.year].found += 1;
    }

    const { canonicals, duplicates } = buildInstitutions(agreements);
    stats.institutionsDuplicates = duplicates;
    const { probable, ambiguous } = detectRelations(canonicals);
    stats.institutionsProbable = probable;
    stats.institutionsAmbiguous = ambiguous;

    const { existingAgreements, existingInstitutions } =
      await collectExisting(prisma, agreements, canonicals);

    for (const inst of canonicals) {
      if (existingInstitutions.has(inst.name)) {
        stats.institutionsExisting += 1;
      } else {
        stats.institutionsNew += 1;
      }
    }

    const typeRows = await prisma.agreement_types.findMany({
      select: { id: true, name: true },
    });
    const typeIdByName: Map<string, bigint> = new Map(
      typeRows.map((t) => [t.name, t.id]),
    );

    if (isVerify) {
      await runVerify(prisma, stats);
      return;
    }

    if (isExecute) {
      printHeader(
        'IMPORTACIÓN REAL — ESCRITURA EN BASE DE DATOS',
      );
      const resolvedInstitutions: Map<string, bigint> = new Map();
      for (const inst of canonicals) {
        if (existingInstitutions.has(inst.name)) {
          continue;
        }
        const created = await prisma.institutions.create({
          data: {
            name: inst.name,
            country: inst.country,
            type: inst.type,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        resolvedInstitutions.set(inst.key, created.id);
      }

      for (const agreement of agreements) {
        const counter = countersPerYear[agreement.year];
        if (existingAgreements.has(agreement.code)) {
          stats.agreementsAlready += 1;
          counter.alreadyExists += 1;
          logAgreement(
            agreement.year,
            agreement.code,
            'SKIPPED_ALREADY_EXISTS',
          );
          continue;
        }
        try {
          const typeId = typeIdByName.get(agreement.agreementTypeName);
          if (!typeId) {
            throw new Error(
              `Tipo de convenio no encontrado: ${agreement.agreementTypeName}`,
            );
          }
          const institutionId =
            resolvedInstitutions.get(agreement.institutionKey) ??
            (
              await prisma.institutions.findFirst({
                where: { name: agreement.institutionName },
                select: { id: true },
              })
            )?.id;
          if (!institutionId) {
            throw new Error(
              `Institución no resuelta: ${agreement.institutionName}`,
            );
          }

          await prisma.$transaction(async (tx) => {
            const created = await tx.agreements.create({
              data: {
                title: agreement.longName,
                name: null,
                resolution_number: agreement.code,
                institution_id: institutionId,
                agreement_type_id: typeId,
                start_date: agreement.startDate
                  ? new Date(agreement.startDate)
                  : null,
                end_date: agreement.endDate
                  ? new Date(agreement.endDate)
                  : null,
                status: agreement.status,
                situation: SITUATION_REGISTERED,
                created_at: new Date(),
                updated_at: new Date(),
              },
            });
            await tx.roadmap_items.createMany({
              data: DEFAULT_AREAS.map((area, index) => ({
                agreement_id: created.id,
                area_name: area,
                order: index,
                is_completed: false,
                created_at: new Date(),
                updated_at: new Date(),
              })),
            });
          });

          stats.agreementsCreated += 1;
          stats.roadmapsCreated += 1;
          counter.created += 1;
          logAgreement(agreement.year, agreement.code, 'CREATED');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          stats.agreementsErrors += 1;
          counter.errors += 1;
          stats.errors.push(`[${agreement.year}] ${agreement.code}: ${message}`);
          logAgreement(
            agreement.year,
            agreement.code,
            'ERROR',
            message,
          );
        }
      }
    } else {
      printHeader('DRY-RUN — NO SE MODIFICA NADA');
      for (const agreement of agreements) {
        const counter = countersPerYear[agreement.year];
        if (existingAgreements.has(agreement.code)) {
          counter.alreadyExists += 1;
          logAgreement(
            agreement.year,
            agreement.code,
            'WOULD_SKIP_ALREADY_EXISTS',
          );
        } else {
          counter.created += 1;
          logAgreement(agreement.year, agreement.code, 'WOULD_CREATE');
        }
      }
      console.log('');
      console.log('Resumen de simulación:');
      for (const entry of SEEDER_FILES) {
        const c = countersPerYear[entry.year];
        console.log(
          `  ${entry.year}: ${c.found} encontrados → ${c.created} nuevos, ${c.alreadyExists} ya existentes, ${c.errors} errores`,
        );
      }
      if (stats.institutionsProbable.length > 0) {
        stats.warnings.push(
          `${stats.institutionsProbable.length} coincidencia(s) probable(s) de institución (acentos/espacios) — NO fusionadas, conservadas como entidades separadas.`,
        );
      }
      if (stats.institutionsAmbiguous.length > 0) {
        stats.warnings.push(
          `${stats.institutionsAmbiguous.length} coincidencia(s) ambigua(s) de institución — NO fusionadas, requieren revisión.`,
        );
      }
      printReport(stats);
    }

    if (isExecute) {
      printReport(stats);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function printReport(stats: Stats): void {
  printHeader('REPORTE DE MIGRACIÓN');
  console.log('Seeders:');
  for (const entry of SEEDER_FILES) {
    console.log(`  ${entry.year} → ${stats.seeders[entry.year]}`);
  }
  console.log(`Total esperado: 447`);
  console.log(`Total encontrado: ${stats.found}`);

  console.log('');
  console.log('Instituciones:');
  console.log(`  Nuevas: ${stats.institutionsNew}`);
  console.log(`  Existentes: ${stats.institutionsExisting}`);
  console.log(`  Duplicados detectados (registros fusionados): ${stats.institutionsDuplicates}`);
  console.log(`  Probables (no fusionadas): ${stats.institutionsProbable.length}`);
  for (const p of stats.institutionsProbable) {
    console.log(`    • ${p.nameA}  ≅  ${p.nameB}`);
  }
  console.log(`  Ambigüas (no fusionadas): ${stats.institutionsAmbiguous.length}`);
  for (const a of stats.institutionsAmbiguous) {
    console.log(`    • ${a.nameA}  ~  ${a.nameB}`);
  }

  console.log('');
  console.log('Convenios:');
  console.log(`  Creados: ${stats.agreementsCreated}`);
  console.log(`  Ya existentes: ${stats.agreementsAlready}`);
  console.log(`  Errores: ${stats.agreementsErrors}`);

  console.log('');
  console.log('Documentos:');
  console.log(`  Disponibles: ${stats.documentsAvailable}`);
  console.log(`  Importados: ${stats.documentsImported}`);
  console.log(`  Ausentes: ${stats.documentsMissing}`);

  console.log('');
  console.log('Roadmaps:');
  console.log(`  Generados: ${stats.roadmapsCreated}`);
  console.log(`  Omitidos: ${stats.roadmapsSkipped}`);

  console.log('');
  console.log(`Errores: ${stats.errors.length}`);
  for (const error of stats.errors) {
    console.log(`  • ${error}`);
  }
  console.log(`Advertencias: ${stats.warnings.length}`);
  for (const warning of stats.warnings) {
    console.log(`  • ${warning}`);
  }
}

type VerifyAgreement = {
  id: bigint;
  title: string;
  resolution_number: string | null;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  situation: string | null;
  institution_id: bigint;
  agreement_type_id: bigint;
};

async function runVerify(prisma: PrismaClient, stats: Stats): Promise<void> {
  printHeader('VALIDACIÓN POST-MIGRACIÓN (SOLO LECTURA)');

  const agreements: VerifyAgreement[] = await prisma.agreements.findMany({
    select: {
      id: true,
      title: true,
      resolution_number: true,
      status: true,
      start_date: true,
      end_date: true,
      situation: true,
      institution_id: true,
      agreement_type_id: true,
    },
    orderBy: { resolution_number: 'asc' },
  });

  const total = agreements.length;
  const perYear: Record<string, number> = {};
  for (const a of agreements) {
    const year = a.resolution_number
      ? a.resolution_number.slice(-4)
      : 'SIN AÑO';
    perYear[year] = (perYear[year] ?? 0) + 1;
  }

  console.log(`Total de convenios en BD: ${total}`);
  for (const entry of SEEDER_FILES) {
    const found = perYear[String(entry.year)] ?? 0;
    const expected = stats.seeders[entry.year];
    const status = found === expected ? 'OK' : 'DESVIACIÓN';
    console.log(`  ${entry.year} → ${found} (esperado ${expected}) [${status}]`);
  }

  const totalExpected = Object.values(stats.seeders).reduce(
    (acc, value) => acc + value,
    0,
  );
  console.log(
    total === totalExpected
      ? 'Conteo total: OK'
      : `Conteo total: DESVIACIÓN (${total} vs ${totalExpected})`,
  );

  const withoutInstitution = agreements.filter(
    (a) => !a.institution_id,
  ).length;
  const withoutType = agreements.filter((a) => !a.agreement_type_id).length;
  const invalidDates = agreements.filter(
    (a) =>
      (a.start_date && Number.isNaN(a.start_date.getTime())) ||
      (a.end_date && Number.isNaN(a.end_date.getTime())),
  ).length;
  const invalidStatus = agreements.filter(
    (a) => !['Vigente', 'Vencido', 'En Proceso'].includes(a.status),
  ).length;
  const invalidSituation = agreements.filter(
    (a) => a.situation !== SITUATION_REGISTERED,
  ).length;

  console.log('');
  console.log('Integridad:');
  console.log(`  Convenios sin institución: ${withoutInstitution}`);
  console.log(`  Convenios sin tipo: ${withoutType}`);
  console.log(`  Convenios con fechas inválidas: ${invalidDates}`);
  console.log(`  Convenios con estado inválido: ${invalidStatus}`);
  console.log(
    `  Convenios con situación distinta de '${SITUATION_REGISTERED}': ${invalidSituation}`,
  );

  const institutions = await prisma.institutions.findMany({
    select: { id: true, name: true, country: true, type: true },
  });
  console.log('');
  console.log(`Total de instituciones en BD: ${institutions.length}`);
  const instWithoutCountry = institutions.filter(
    (i) => !i.country || i.country.trim() === '',
  ).length;
  const instWithoutType = institutions.filter(
    (i) => !i.type || i.type.trim() === '',
  ).length;
  console.log(`  Instituciones sin país: ${instWithoutCountry}`);
  console.log(`  Instituciones sin tipo: ${instWithoutType}`);

  const typeCounts = new Map<string, number>();
  for (const i of institutions) {
    typeCounts.set(i.type, (typeCounts.get(i.type) ?? 0) + 1);
  }
  console.log('  Distribución por tipo:');
  for (const [type, count] of Array.from(typeCounts.entries()).sort((a, b) =>
    b[1] - a[1],
  )) {
    console.log(`    ${type}: ${count}`);
  }

  const withRoadmap = await prisma.agreements.count({
    where: { roadmap_items: { some: {} } },
  });
  const roadmapAreaCounts = await prisma.roadmap_items.groupBy({
    by: ['agreement_id'],
    _count: { id: true },
  });
  const notFour = roadmapAreaCounts.filter((r) => r._count.id !== 4).length;
  console.log('');
  console.log(`Convenios con roadmap: ${withRoadmap}`);
  console.log(`Convenios con roadmap distinto de 4 áreas: ${notFour}`);

  const agreementsRes = new Map<string, VerifyAgreement[]>();
  for (const a of agreements) {
    const key = `${a.title}||${a.institution_id}||${a.agreement_type_id}`;
    const list = agreementsRes.get(key) ?? [];
    list.push(a);
    agreementsRes.set(key, list);
  }
  const duplicatedGroups = Array.from(agreementsRes.values()).filter(
    (list) => list.length > 1,
  );
  console.log('');
  console.log(
    `Grupos de convenios con misma firma (título+institución+tipo): ${duplicatedGroups.length}`,
  );
  for (const group of duplicatedGroups) {
    console.log(
      `  • "${group[0].title}" → ${group
        .map((a) => a.resolution_number ?? `#${a.id}`)
        .join(', ')}`,
    );
  }

  const invertedDates = agreements.filter(
    (a) => a.start_date && a.end_date && a.end_date < a.start_date,
  ).length;
  console.log(`Convenios con end_date anterior a start_date: ${invertedDates}`);

  const instNames = new Map<string, number>();
  for (const i of institutions) {
    instNames.set(i.name, (instNames.get(i.name) ?? 0) + 1);
  }
  const duplicatedInstitutions = Array.from(instNames.values()).filter(
    (count) => count > 1,
  ).length;
  console.log(`Instituciones duplicadas por nombre exacto: ${duplicatedInstitutions}`);

  const orphanInstitutions = await prisma.institutions.findMany({
    where: { agreements: { none: {} } },
    select: { id: true, name: true },
  });
  console.log(
    `Instituciones sin convenios (huérfanas): ${orphanInstitutions.length}`,
  );
  for (const inst of orphanInstitutions) {
    console.log(`  • #${inst.id} ${inst.name}`);
  }

  const roadmapItemsCount = await prisma.roadmap_items.count();
  console.log(
    `Total de roadmap items en BD: ${roadmapItemsCount}`,
  );

  const agreementTypes = await prisma.agreement_types.findMany({
    select: { id: true, name: true },
  });
  const agreementsByType = await prisma.agreements.groupBy({
    by: ['agreement_type_id'],
    _count: { id: true },
  });
  console.log('');
  console.log('Distribución por tipo de convenio:');
  for (const t of agreementTypes) {
    const count = agreementsByType.find(
      (row) => row.agreement_type_id === t.id,
    )?._count.id ?? 0;
    console.log(`  ${t.name}: ${count}`);
  }

  const statusCounts = new Map<string, number>();
  for (const a of agreements) {
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
  }
  console.log('');
  console.log('Distribución por estado:');
  for (const [status, count] of statusCounts) {
    console.log(`  ${status}: ${count}`);
  }
}

run().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
