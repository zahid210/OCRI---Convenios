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
