import { Test } from '@nestjs/testing';
import { SeguimientoService } from './seguimiento.service';
import { PrismaService } from '../prisma/prisma.service';

const agreementRow = {
  id: 1,
  tramite_code: 'TR-001',
  resolution_number: null,
  title: 'Convenio A',
  process_status: 'EN_SEGUIMIENTO',
  institutions: { name: 'UNCP', country: 'PERÚ' },
  deliverables: [],
};

type FindManyArgs = {
  where: Record<string, unknown>;
  skip?: number;
  take?: number;
};
type CountArgs = { where: Record<string, unknown> };

describe('SeguimientoService.findAll (paginación en SQL)', () => {
  let service: SeguimientoService;
  let findWhere: Record<string, unknown> | undefined;
  let findArgs: FindManyArgs | undefined;
  let countWhere: Record<string, unknown> | undefined;

  beforeEach(async () => {
    findWhere = undefined;
    findArgs = undefined;
    countWhere = undefined;

    const findMany = jest.fn((args: FindManyArgs) => {
      findArgs = args;
      findWhere = args.where;
      return Promise.resolve([{ ...agreementRow }]);
    });
    const count = jest.fn((args: CountArgs) => {
      countWhere = args.where;
      return Promise.resolve(1);
    });

    const tx = { agreements: { findMany, count } };
    const prisma = {
      $transaction: jest.fn(
        (fn: (t: typeof tx) => Promise<unknown>): Promise<unknown> => fn(tx),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        SeguimientoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SeguimientoService);
  });

  it('pagina con skip/take y devuelve el total del filtro', async () => {
    const out = await service.findAll({ page: 2, per_page: 10 });

    expect(findArgs).toEqual(expect.objectContaining({ skip: 10, take: 10 }));
    expect(countWhere).toBeDefined();
    expect(out.meta).toEqual({ total: 1, page: 2, per_page: 10, last_page: 1 });
  });

  it('con pendientes=true añade la condición sin_entregables OR pendiente_completar', async () => {
    await service.findAll({ pendientes: 'true' } as never);

    expect(findWhere).toBeDefined();
    const and = (findWhere?.AND as Record<string, unknown>[]).slice();
    const or = and[0].OR as Record<string, unknown>[];

    expect(and).toHaveLength(1);
    // rama sin_entregables: sin deliverables
    expect(or[0]).toEqual({ deliverables: { none: {} } });
    // rama pendiente_completar: al menos uno y algún entregable sin REGISTRAR
    expect(or[1]).toEqual({
      AND: [
        { deliverables: { some: {} } },
        { deliverables: { some: { status: { not: 'REGISTRADO' } } } },
      ],
    });
    // el count usa el MISMO where filtrado
    expect(countWhere).toEqual(findWhere);
  });

  it('respeta where previo (search) y añade sin romperlo', async () => {
    await service.findAll({
      page: 1,
      per_page: 10,
      search: '  convenio  ',
      pendientes: 'true',
    } as never);

    expect(findWhere).toHaveProperty('OR');
    expect(Array.isArray((findWhere as { AND?: unknown[] }).AND)).toBe(true);
  });

  it('sin pendientes=true no agrega condiciones extra', async () => {
    await service.findAll({ page: 1, per_page: 10 });

    expect(findWhere).not.toHaveProperty('AND');
  });
});
