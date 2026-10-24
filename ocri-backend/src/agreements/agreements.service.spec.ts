import { Test } from '@nestjs/testing';
import { AgreementsService } from './agreements.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';

function agreementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    tramite_code: '013-2021',
    title: 'CONVENIO DE PRUEBA',
    name: null,
    resolution_number: 'R-001',
    validity_status: 'VIGENTE',
    process_status: 'PUBLICADO',
    start_date: new Date('2021-01-01'),
    end_date: new Date('2030-01-01'),
    institutions: { name: 'UNCP' },
    agreement_types: { name: 'MARCO' },
    responsables: [{ id: 1n, name: 'Pepe', email: 'pepe@uncp.edu.pe' }],
    drive_link: 'https://drive.example/abc',
    registered_at: new Date('2021-01-02'),
    ...overrides,
  };
}

describe('AgreementsService · getExpirationTracking (confinamiento B6-9)', () => {
  let service: AgreementsService;
  let findMany: jest.Mock<Promise<unknown[]>, [Record<string, unknown>]>;

  beforeEach(async () => {
    findMany = jest.fn((...args: [Record<string, unknown>]) => {
      void args;
      return Promise.resolve([agreementRow()]);
    });
    const prisma = { agreements: { findMany } };
    const module = await Test.createTestingModule({
      providers: [
        AgreementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();
    service = module.get(AgreementsService);
  });

  it('incluye drive_link y responsables para un rol operativo', async () => {
    const rows = (await service.getExpirationTracking('procesador')) as Array<
      Record<string, unknown>
    >;
    expect(rows[0].drive_link).toBe('https://drive.example/abc');
    expect(rows[0].responsables).toEqual([
      expect.objectContaining({ name: 'Pepe' }),
    ]);
  });

  it('omite drive_link y responsables para el rol viewer (B6-9)', async () => {
    const rows = (await service.getExpirationTracking('viewer')) as Array<
      Record<string, unknown>
    >;
    expect(rows[0].drive_link).toBeUndefined();
    expect(rows[0].responsables).toBeUndefined();
    // El semáforo (lo visible para el rol) sigue presente.
    expect(rows[0].temporal_status).toBe('VIGENTE');
    expect(rows[0].resolution_number).toBe('R-001');
    // El where confina al rol a los estados visibles.
    const where = findMany.mock.calls[0][0] as {
      where: { process_status?: { in?: string[] } };
    };
    expect(where.where.process_status?.in).toEqual(
      expect.arrayContaining(['REGISTRADO', 'PUBLICADO', 'EN_SEGUIMIENTO']),
    );
  });

  it('no confina el where a un rol operativo', async () => {
    await service.getExpirationTracking('admin');
    const args = findMany.mock.calls[0][0] as {
      where: { process_status?: { in?: string[] } };
    };
    expect(args.where.process_status?.in).toEqual(
      expect.arrayContaining(['SUSCRITO', 'PUBLICADO', 'EN_SEGUIMIENTO']),
    );
  });
});

describe('AgreementsService · autogeneración correlativa de tramite_code (H14)', () => {
  let service: AgreementsService;
  let existingCodes: Array<{ tramite_code: string }>;
  let createdData: Record<string, unknown> | undefined;

  beforeEach(async () => {
    existingCodes = [];
    createdData = undefined;

    const tx = {
      agreements: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((args: { data: Record<string, unknown> }) => {
          createdData = args.data;
          return Promise.resolve({
            id: 10n,
            ...args.data,
          });
        }),
      },
      document_types: {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 1n, name: 'Dictamen' }),
        ),
      },
      documents: {
        create: jest.fn(() => Promise.resolve({ id: 1n })),
      },
      process_events: {
        create: jest.fn(() => Promise.resolve({ id: 1n })),
      },
    };

    const prisma = {
      agreements: {
        findMany: jest.fn(() => Promise.resolve(existingCodes)),
      },
      $transaction: jest.fn(
        (fn: (t: typeof tx) => Promise<unknown>): Promise<unknown> => fn(tx),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        AgreementsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: StorageService,
          useValue: {
            putUnique: jest.fn((relPath: string) => Promise.resolve(relPath)),
          },
        },
      ],
    }).compile();

    service = module.get(AgreementsService);
  });

  it('genera 001-YYYY cuando no hay propuestas previas en el año actual', async () => {
    const year = new Date().getFullYear();
    existingCodes = [];

    await service.create({
      title: 'Propuesta nueva',
      institution_id: 1,
      agreement_type_id: 1,
    });

    expect(createdData?.tramite_code).toBe(`001-${year}`);
  });

  it('genera el correlativo siguiente (002-YYYY) a partir del mayor del año actual', async () => {
    const year = new Date().getFullYear();
    existingCodes = [{ tramite_code: `001-${year}` }];

    await service.create({
      title: 'Segunda propuesta',
      institution_id: 1,
      agreement_type_id: 1,
    });

    expect(createdData?.tramite_code).toBe(`002-${year}`);
  });
});
