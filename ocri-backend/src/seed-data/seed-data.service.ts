import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { CatalogsService } from '../catalogs/catalogs.service';

// -----------------------------------------------------------------------------
// Carga inicial versionada (reemplaza al dump SQL del primer arranque).
//
// - Catálogos: delega en CatalogsService.seedAll() (idempotente, fuente única en
//   catalogs.data.ts / dependencias.data.ts).
// - Datos históricos: los lee de prisma/seed-data/*.json SOLO si la tabla
//   `agreements` está vacía, de modo que nunca pisa datos de una base en uso.
//
// Las claves foráneas a catálogos/usuarios se guardan en el JSON como nombres,
// códigos o emails (no ids) y se resuelven aquí contra la base, para no depender
// del auto-incremento de esos catálogos.
// -----------------------------------------------------------------------------

type SeedValue = string | number | null;
type SeedRow = Record<string, SeedValue>;

interface TableSeed {
  table: string;
  columns: string[];
  rows: SeedValue[][];
}

@Injectable()
export class SeedDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogs: CatalogsService,
  ) {}

  // Se ejecuta tras `onModuleInit` de todos los módulos (SeedUsersService ya
  // creó las cuentas), de modo que la resolución por email funciona.
  async onApplicationBootstrap(): Promise<void> {
    await this.seedInitial();
  }

  async seedInitial(): Promise<void> {
    await this.catalogs.seedAll();
    await this.syncExpiredAgreements();

    const existing = await this.prisma.agreements.count();
    if (existing > 0) {
      this.logger.log(
        `Datos históricos ya presentes (${existing} convenios); se omite la carga inicial.`,
      );
      return;
    }

    const docTypeId = await this.mapId('document_types', 'code');
    const agreementTypeId = await this.mapId('agreement_types', 'name');
    const userId = await this.mapId('users', 'email');

    const institutions = this.read('institutions.json');
    const agreements = this.read('agreements.json');
    const documents = this.read('documents.json');
    const processEvents = this.read('process_events.json');
    const acknowledgements = this.read('notification_acknowledgements.json');

    const seeds: TableSeed[] = [
      {
        table: 'institutions',
        columns: ['id', 'name', 'country', 'type', 'created_at', 'updated_at'],
        rows: institutions.map((r) => [
          r.id,
          r.name,
          r.country,
          r.type,
          r.created_at,
          r.updated_at,
        ]),
      },
      {
        table: 'agreements',
        columns: [
          'id',
          'tramite_code',
          'title',
          'name',
          'applicant_name',
          'applicant_email',
          'applicant_unit',
          'rectorate_oficio_number',
          'institution_id',
          'agreement_type_id',
          'resolution_number',
          'start_date',
          'end_date',
          'drive_link',
          'process_status',
          'validity_status',
          'stage',
          'rectorate_decision',
          'rectorate_decision_at',
          'notified_solicitante_at',
          'published_at',
          'registered_at',
          'monitoring_concluded_at',
          'observations',
          'created_at',
          'updated_at',
        ],
        rows: agreements.map((r) => [
          r.id,
          r.tramite_code,
          r.title,
          r.name,
          r.applicant_name,
          r.applicant_email,
          r.applicant_unit,
          r.rectorate_oficio_number,
          r.institution_id,
          this.resolve(agreementTypeId, r.agreement_type, 'tipo de convenio'),
          r.resolution_number,
          r.start_date,
          r.end_date,
          r.drive_link,
          r.process_status,
          r.validity_status,
          r.stage,
          r.rectorate_decision,
          r.rectorate_decision_at,
          r.notified_solicitante_at,
          r.published_at,
          r.registered_at,
          r.monitoring_concluded_at,
          r.observations,
          r.created_at,
          r.updated_at,
        ]),
      },
      {
        table: 'documents',
        columns: [
          'id',
          'agreement_id',
          'name',
          'file_path',
          'original_name',
          'extension',
          'document_type_id',
          'direction',
          'stage',
          'created_at',
          'updated_at',
        ],
        rows: documents.map((r) => [
          r.id,
          r.agreement_id,
          r.name,
          r.file_path,
          r.original_name,
          r.extension,
          this.resolve(docTypeId, r.document_type, 'tipo de documento'),
          r.direction,
          r.stage,
          r.created_at,
          r.updated_at,
        ]),
      },
      {
        table: 'process_events',
        columns: [
          'id',
          'agreement_id',
          'stage',
          'event_type',
          'description',
          'actor_user_id',
          'from_value',
          'to_value',
          'occurred_at',
          'metadata',
        ],
        rows: processEvents.map((r) => [
          r.id,
          r.agreement_id,
          r.stage,
          r.event_type,
          r.description,
          this.resolveOptional(userId, r.actor_email, 'usuario'),
          r.from_value,
          r.to_value,
          r.occurred_at,
          r.metadata,
        ]),
      },
      {
        table: 'notification_acknowledgements',
        columns: ['id', 'user_id', 'key', 'read_at'],
        rows: acknowledgements.map((r) => [
          r.id,
          this.resolve(userId, r.user_email, 'usuario'),
          r.key,
          r.read_at,
        ]),
      },
    ];

    await this.prisma.$transaction(async (tx) => {
      for (const seed of seeds) {
        await this.insert(seed, tx);
      }
    });

    await this.syncExpiredAgreements();

    this.logger.log(
      `Datos históricos sembrados: ${institutions.length} instituciones, ` +
        `${agreements.length} convenios, ${documents.length} documentos, ` +
        `${processEvents.length} eventos, ${acknowledgements.length} acuses.`,
    );
  }

  private async syncExpiredAgreements(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const { count } = await this.prisma.agreements.updateMany({
      where: {
        validity_status: 'VIGENTE',
        end_date: { lt: startOfToday },
      },
      data: {
        validity_status: 'VENCIDO',
      },
    });

    if (count > 0) {
      this.logger.log(
        `Vigencia sincronizada: ${count} convenio(s) con fecha vencida marcados como VENCIDO.`,
      );
    }
  }

  private read(name: string): SeedRow[] {
    const file = join(process.cwd(), 'prisma', 'seed-data', name);
    return JSON.parse(readFileSync(file, 'utf8')) as SeedRow[];
  }

  private async mapId(
    table: string,
    key: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: number; k: string }>
    >(`SELECT id, \`${key}\` AS k FROM \`${table}\``);
    return new Map(rows.map((r) => [String(r.k), Number(r.id)]));
  }

  private resolve(
    map: Map<string, number>,
    key: SeedValue,
    what: string,
  ): number {
    const id = map.get(String(key));
    if (id === undefined) {
      throw new Error(`Seed: ${what} "${String(key)}" no existe en la base`);
    }
    return id;
  }

  private resolveOptional(
    map: Map<string, number>,
    key: SeedValue,
    what: string,
  ): number | null {
    return key === null || key === '' ? null : this.resolve(map, key, what);
  }

  private async insert(
    seed: TableSeed,
    executor: Pick<PrismaService, '$executeRawUnsafe'> = this.prisma,
  ): Promise<void> {
    if (seed.rows.length === 0) return;
    const cols = seed.columns.map((c) => `\`${c}\``).join(', ');
    const tuple = `(${seed.columns.map(() => '?').join(', ')})`;
    const CHUNK = 100;
    for (let i = 0; i < seed.rows.length; i += CHUNK) {
      const chunk = seed.rows.slice(i, i + CHUNK);
      const values: SeedValue[] = [];
      const tuples = chunk.map((row) => {
        values.push(...row);
        return tuple;
      });
      await executor.$executeRawUnsafe(
        `INSERT INTO \`${seed.table}\` (${cols}) VALUES ${tuples.join(', ')}`,
        ...values,
      );
    }
  }
}
