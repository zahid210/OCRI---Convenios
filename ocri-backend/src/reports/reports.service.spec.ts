import { Test } from '@nestjs/testing';
import * as ExcelJS from 'exceljs';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_STATUSES } from './dto/filter-reports.dto';
import { IN_FLIGHT_STATUSES } from '../common/process.constants';
import { VIEWER_VISIBLE_STATUSES } from '../common/visibility';

/**
 * Regresión de la auditoría de /reports: los agregados derivan el estado
 * temporal desde fechas y no había tests que fijaran el `where` construido
 * para cada filtro (En Trámite, Vigente, Por Vencer, Vencido, Sin Fecha),
 * ni la normalización de país, ni el tope de top-institutions, ni el export.
 */
describe('ReportsService', () => {
  let service: ReportsService;

  const prisma = {
    agreements: { findMany: jest.fn() },
  };

  const hoy = (): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const enDias = (n: number): Date => {
    const d = hoy();
    d.setDate(d.getDate() + n);
    return d;
  };

  const convenio = (over: Record<string, unknown> = {}) => ({
    id: 1n,
    title: 'Convenio de prueba',
    tramite_code: 'T-0001',
    resolution_number: null,
    process_status: 'SUSCRITO',
    start_date: enDias(-500),
    end_date: null,
    agreement_type_id: 1n,
    institution_id: 1n,
    institutions: { name: 'Universidad Nacional', country: 'Perú' },
    agreement_types: { name: 'Marco' },
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.agreements.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ReportsService);
  });

  /** Argumentos con los que se llamó a prisma.agreements.findMany. */
  interface FindManyArgs {
    where: Record<string, unknown>;
  }
  const ultimoWhere = (): Record<string, unknown> => {
    const llamadas = prisma.agreements.findMany.mock.calls as Array<
      [FindManyArgs]
    >;
    const ultima = llamadas[llamadas.length - 1];
    return ultima ? ultima[0].where : {};
  };

  describe('buildWhere (filtros)', () => {
    it("mapea 'En Trámite' a los estados previos a la suscripción", async () => {
      await service.summary({ status: 'En Trámite' });
      expect(ultimoWhere().process_status).toEqual({
        in: [...IN_FLIGHT_STATUSES],
      });
    });

    it("mapea 'No Suscrito' al estado NO_SUSCRITO", async () => {
      await service.summary({ status: 'No Suscrito' });
      expect(ultimoWhere().process_status).toBe('NO_SUSCRITO');
    });

    it("mapea 'Sin Fecha' a convenios suscritos sin fecha fin", async () => {
      await service.summary({ status: 'Sin Fecha' });
      expect(ultimoWhere().end_date).toBeNull();
      expect(ultimoWhere().process_status).toEqual({
        in: [
          'SUSCRITO',
          'REGISTRADO',
          'PUBLICADO',
          'EN_SEGUIMIENTO',
          'SEGUIMIENTO_CONCLUIDO',
        ],
      });
    });

    it("mapea 'Por Vencer' a la ventana de aviso (hoy; hoy + 90 días)", async () => {
      await service.summary({ status: 'Por Vencer' });
      const { gte, lte } = ultimoWhere().end_date as {
        gte: Date;
        lte: Date;
      };
      const ventana = lte.getTime() - gte.getTime();
      expect(ventana).toBeGreaterThanOrEqual(89 * 86_400_000);
      expect(ventana).toBeLessThanOrEqual(91 * 86_400_000);
    });

    it("mapea 'Vencido' a fechas fin anteriores a hoy", async () => {
      await service.summary({ status: 'Vencido' });
      const { lt } = ultimoWhere().end_date as { lt: Date };
      expect(lt.getTime()).toBeLessThanOrEqual(hoy().getTime() + 1000);
    });

    it('filtra por país exacto', async () => {
      await service.summary({ country: 'Argentina' });
      expect(ultimoWhere().institutions).toEqual({ country: 'Argentina' });
    });

    it('convierte agreement_type_id e institution_id a BigInt', async () => {
      await service.summary({ agreement_type_id: 7, institution_id: 4 });
      expect(ultimoWhere().agreement_type_id).toBe(7n);
      expect(ultimoWhere().institution_id).toBe(4n);
    });
  });

  describe('confinamiento por rol (Fase 5 · H5.1)', () => {
    it('sin filtro de estado, el viewer queda acotado a los estados visibles', async () => {
      await service.summary({}, 'viewer');
      expect(ultimoWhere().process_status).toEqual({
        in: [...VIEWER_VISIBLE_STATUSES],
      });
    });

    it('un rol de operación no recibe restricción de estado', async () => {
      await service.summary({}, 'admin');
      expect(ultimoWhere().process_status).toBeUndefined();
    });

    it("'En Trámite' se intersecta con lo visible: el viewer no ve nada", async () => {
      await service.summary({ status: 'En Trámite' }, 'viewer');
      expect(ultimoWhere().process_status).toEqual({ in: [] });
    });

    it("'No Suscrito' (estado oculto) también se vacía para el viewer", async () => {
      await service.summary({ status: 'No Suscrito' }, 'viewer');
      expect(ultimoWhere().process_status).toEqual({ in: [] });
    });

    it("'Vigente' conserva solo los estados visibles para el viewer", async () => {
      await service.summary({ status: 'Vigente' }, 'viewer');
      expect(ultimoWhere().process_status).toEqual({
        in: [...VIEWER_VISIBLE_STATUSES],
      });
    });

    it('la exportación XLSX aplica el confinamiento a todas sus consultas', async () => {
      await service.exportXlsx({}, 'viewer');
      const llamadas = prisma.agreements.findMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;
      expect(llamadas.length).toBeGreaterThan(0);
      for (const [args] of llamadas) {
        expect(args.where.process_status).toEqual({
          in: [...VIEWER_VISIBLE_STATUSES],
        });
      }
    });
  });

  describe('summary / deriveStatus', () => {
    it('agrupa por estado derivado (NO_SUSCRITO, En Trámite y semáforo)', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({ id: 1n, process_status: 'NO_SUSCRITO' }),
        convenio({ id: 2n, process_status: 'ENVIADO_A_RECTORADO' }),
        convenio({ id: 3n, end_date: enDias(200) }), // Vigente
        convenio({ id: 4n, end_date: enDias(45) }), // Por Vencer
        convenio({ id: 5n, end_date: enDias(-20) }), // Vencido
        convenio({ id: 6n, end_date: null }), // Sin Fecha
      ]);

      const r = await service.summary({});

      expect(r.total).toBe(6);
      expect(r.por_estado).toEqual({
        'No Suscrito': 1,
        'En Trámite': 1,
        Vigente: 1,
        'Por Vencer': 1,
        Vencido: 1,
        'Sin Fecha': 1,
      });
      expect(r.en_tramite).toBe(1);
      expect(r.vigentes).toBe(1);
      expect(r.proximos_a_vencer).toBe(1);
      expect(r.vencidos).toBe(1);
      expect(r.no_suscritos).toBe(1);
    });
  });

  describe('byStatus', () => {
    it('devuelve siempre las seis filas en orden, rellenando con ceros', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({ process_status: 'RECEPCIONADA' }),
      ]);

      const r = await service.byStatus({});

      expect(r.map((fila) => fila.estado)).toEqual([...REPORT_STATUSES]);
      expect(r.map((fila) => fila.cantidad)).toEqual([1, 0, 0, 0, 0, 0]);
    });
  });

  describe('byCountry', () => {
    it('normaliza el país a mayúsculas con "SIN PAÍS" y ordena desc', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({ id: 1n, institutions: { name: 'A', country: 'perú' } }),
        convenio({ id: 2n, institutions: { name: 'B', country: 'perú' } }),
        convenio({ id: 3n, institutions: null }),
      ]);

      const r = await service.byCountry({});

      expect(r).toEqual([
        { pais: 'PERÚ', cantidad: 2 },
        { pais: 'SIN PAÍS', cantidad: 1 },
      ]);
    });
  });

  describe('byType / byInstitution / topInstitutions', () => {
    it('usa "Sin tipo" cuando el tipo es null', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({ agreement_types: null }),
      ]);
      expect(await service.byType({})).toEqual([
        { tipo: 'Sin tipo', cantidad: 1 },
      ]);
    });

    it('agrupa por institución y ordena desc', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({
          id: 1n,
          institutions: { name: 'Instituto A', country: 'BRASIL' },
        }),
        convenio({
          id: 2n,
          institutions: { name: 'Instituto A', country: 'BRASIL' },
        }),
        convenio({
          id: 3n,
          institutions: { name: 'Instituto B', country: 'CHILE' },
        }),
      ]);

      const r = await service.byInstitution({});

      expect(r).toEqual([
        { institucion: 'Instituto A', pais: 'BRASIL', cantidad: 2 },
        { institucion: 'Instituto B', pais: 'CHILE', cantidad: 1 },
      ]);
    });

    it('aplica el tope de top y usa 10 por defecto', async () => {
      const filas = Array.from({ length: 15 }, (_, i) =>
        convenio({
          id: BigInt(i + 1),
          institutions: { name: `Inst ${i}`, country: 'PE' },
        }),
      );
      prisma.agreements.findMany.mockResolvedValue(filas);

      expect((await service.topInstitutions({})).length).toBe(10);
      expect((await service.topInstitutions({ top: 3 })).length).toBe(3);
    });
  });

  describe('expiring / expired', () => {
    const filas = [
      convenio({ id: 1n, end_date: enDias(200), title: 'Vigente lejos' }),
      convenio({ id: 2n, end_date: enDias(45), title: 'Por vencer' }),
      convenio({ id: 3n, end_date: enDias(-20), title: 'Vencido' }),
    ];

    it('expiring solo incluye POR_VENCER, ordenado por fecha ascendente', async () => {
      prisma.agreements.findMany.mockResolvedValue(filas);

      const r = await service.expiring({});

      expect(r).toHaveLength(1);
      expect(r[0].titulo).toBe('Por vencer');
      expect(r[0].fecha_fin).toBe(enDias(45).toISOString().slice(0, 10));
      expect(r[0].estado).toBe('Por Vencer');
    });

    it('expired solo incluye VENCIDO, ordenado por fecha descendente', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        ...filas,
        convenio({ id: 4n, end_date: enDias(-90), title: 'Vencido antiguo' }),
      ]);

      const r = await service.expired({});

      expect(r.map((f) => f.titulo)).toEqual(['Vencido', 'Vencido antiguo']);
      expect(r.every((f) => f.estado === 'Vencido')).toBe(true);
    });
  });

  describe('exportXlsx', () => {
    it('genera un archivo .xlsx con las siete hojas y los datos esperados', async () => {
      prisma.agreements.findMany.mockResolvedValue([
        convenio({ id: 1n, end_date: enDias(45), title: 'Por vencer' }),
        convenio({ id: 2n, end_date: enDias(-20), title: 'Vencido' }),
      ]);

      const buffer = await service.exportXlsx({});

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 2).toString()).toBe('PK');

      const wb = new ExcelJS.Workbook();
      // ExcelJS tipa load() con su propio Buffer (extends ArrayBuffer); copiamos
      // a un ArrayBuffer nuevo para no depender del buffer (con pool) de Node.
      const copia = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(copia).set(buffer);
      await wb.xlsx.load(copia);
      expect(wb.worksheets.map((ws) => ws.name)).toEqual([
        'Resumen',
        'Por Estado',
        'Por País',
        'Por Tipo',
        'Por Institución',
        'Próximos a Vencer',
        'Vencidos',
      ]);

      const proximos = wb.getWorksheet('Próximos a Vencer');
      expect(proximos).toBeDefined();
      expect(proximos?.getRow(3).getCell(1).text).toBe('T-0001');
    });
  });
});
