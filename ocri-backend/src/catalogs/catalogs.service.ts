import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DependenciasService } from '../dependencias/dependencias.service';
import { AuditActor } from '../audit/audit.service';
import {
  AGREEMENT_TYPES,
  APP_CONFIG_DEFAULTS,
  DOCUMENT_TYPES,
} from './catalogs.data';

export interface CatalogSeedResult {
  document_types: number;
  dependencias: string;
  agreement_types: number;
  app_config: number;
}

/**
 * Siembra los catálogos base desde `catalogs.data.ts` / `dependencias.data.ts`.
 *
 * Es la vía única (antes: POST /document-types/seed, POST /dependencias/seed y
 * el script con listas divergentes). Idempotente: se puede ejecutar en cada
 * arranque/despliegue sin duplicar filas.
 */
@Injectable()
export class CatalogsService {
  private readonly logger = new Logger(CatalogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dependencias: DependenciasService,
  ) {}

  async seedAll(actor?: AuditActor): Promise<CatalogSeedResult> {
    // Tipos de documento: se alinean nombre/dirección para que la base coincida
    // con el catálogo canónico. `is_active` NO se toca (desactivar un tipo es una
    // decisión operativa que el seed no debe revertir).
    for (const t of DOCUMENT_TYPES) {
      await this.prisma.document_types.upsert({
        where: { code: t.code },
        update: { name: t.name, direction: t.direction },
        create: {
          code: t.code,
          name: t.name,
          direction: t.direction,
          is_active: true,
        },
      });
    }

    // Dependencias: delega en su servicio (dedupe por código/nombre + auditoría).
    const { message } = await this.dependencias.seed(actor);

    // Tipos de convenio: clave única por nombre (@unique en schema.prisma).
    for (const name of AGREEMENT_TYPES) {
      await this.prisma.agreement_types.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    for (const c of APP_CONFIG_DEFAULTS) {
      await this.prisma.app_config.upsert({
        where: { key: c.key },
        update: {},
        create: { key: c.key, value: c.value },
      });
    }

    this.logger.log(
      `Catálogos sembrados: ${DOCUMENT_TYPES.length} tipos de documento; ` +
        `${message}; ${AGREEMENT_TYPES.length} tipos de convenio; ` +
        `${APP_CONFIG_DEFAULTS.length} parámetros`,
    );

    return {
      document_types: DOCUMENT_TYPES.length,
      dependencias: message,
      agreement_types: AGREEMENT_TYPES.length,
      app_config: APP_CONFIG_DEFAULTS.length,
    };
  }
}
