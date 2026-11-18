import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdendasService } from './adendas.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { StorageService } from '../common/storage/storage.service';

describe('AdendasService', () => {
  let service: AdendasService;

  const prismaBase = {
    agreements: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adendas: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    dependencias: {
      findMany: jest.fn(),
    },
    opinion_requests: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    document_types: {
      findUnique: jest.fn(),
    },
    documents: {
      create: jest.fn(),
    },
    deliverables: {
      create: jest.fn(),
    },
    agreement_responsables: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    process_events: {
      create: jest.fn(),
    },
  };

  const prisma = {
    ...prismaBase,
    $transaction: jest.fn(
      async (cb: (tx: typeof prismaBase) => Promise<unknown>) => cb(prismaBase),
    ),
  };

  const appConfig = {
    getOpinionDefaultDays: jest.fn().mockResolvedValue(5),
  };

  const storage = {
    putUnique: jest
      .fn()
      .mockResolvedValue('2025/001-2025/adendas/adenda-01/adenda.pdf'),
    removeRel: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AdendasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AppConfigService, useValue: appConfig },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(AdendasService);
  });

  it('impide iniciar adenda si el convenio no está EN_SEGUIMIENTO', async () => {
    prisma.agreements.findUnique.mockResolvedValue({
      id: 1n,
      process_status: 'PUBLICADO',
    });

    await expect(
      service.createAdenda(1, {
        type: 'ADENDA_PRORROGA',
        dependencia_ids: [1],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('impide iniciar adenda si ya existe una EN_OPINIONES', async () => {
    prisma.agreements.findUnique.mockResolvedValue({
      id: 1n,
      process_status: 'EN_SEGUIMIENTO',
    });
    prisma.adendas.findFirst.mockResolvedValue({
      id: 10n,
      correlative: 1,
      status: 'EN_OPINIONES',
    });

    await expect(
      service.createAdenda(1, {
        type: 'ADENDA_MODIFICACION',
        dependencia_ids: [1],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('crea la adenda con correlativo incremental y sus solicitudes de opinión en ETAPA_3_SEGUIMIENTO', async () => {
    prisma.agreements.findUnique.mockResolvedValue({
      id: 1n,
      process_status: 'EN_SEGUIMIENTO',
    });
    prisma.adendas.findFirst.mockResolvedValue(null);
    prisma.dependencias.findMany.mockResolvedValue([{ id: 2n }, { id: 3n }]);
    prisma.adendas.aggregate.mockResolvedValue({ _max: { correlative: 1 } });
    prisma.adendas.create.mockResolvedValue({
      id: 20n,
      agreement_id: 1n,
      correlative: 2,
      type: 'ADENDA_PRORROGA',
      status: 'EN_OPINIONES',
    });

    const result = await service.createAdenda(
      1,
      {
        type: 'ADENDA_PRORROGA',
        description: 'Prórroga por 2 años',
        dependencia_ids: [2, 3],
      },
      99,
    );

    expect(result.correlative).toBe(2);
    expect(prisma.opinion_requests.create).toHaveBeenCalledTimes(2);
    const firstCall = prisma.opinion_requests.create.mock.calls[0] as [
      { data: { stage: string; adenda_id: bigint; status: string } },
    ];
    expect(firstCall[0].data.stage).toBe('ETAPA_3_SEGUIMIENTO');
    expect(firstCall[0].data.adenda_id).toBe(20n);
    expect(firstCall[0].data.status).toBe('GENERADA');
  });

  it('al registrar ADENDA_PRORROGA exige nueva fecha de fin posterior y crea nuevo Plan de Trabajo', async () => {
    prisma.adendas.findUnique.mockResolvedValue({
      id: 5n,
      agreement_id: 1n,
      correlative: 1,
      type: 'ADENDA_PRORROGA',
      status: 'EN_OPINIONES',
      agreements: {
        id: 1n,
        tramite_code: '001-2025',
        created_at: new Date('2025-02-01'),
        process_status: 'EN_SEGUIMIENTO',
        start_date: new Date('2025-02-01'),
        end_date: new Date('2026-02-01'),
      },
      opinion_requests: [{ id: 100n, status: 'VALIDADA' }],
    });
    prisma.document_types.findUnique.mockResolvedValue({ id: 99n });
    prisma.adendas.update.mockResolvedValue({
      id: 5n,
      status: 'REGISTRADA',
    });

    const fakeFile = {
      originalname: 'adenda-01.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
      size: 8,
    };

    await service.registerAdenda(
      5,
      { new_end_date: '2028-02-01', resolution_number: 'RR-100-2026' },
      fakeFile,
      1,
    );

    const agreementUpdateCall = prisma.agreements.update.mock.calls[0] as [
      { data: { validity_status: string } },
    ];
    expect(agreementUpdateCall[0].data.validity_status).toBe('VIGENTE');

    const deliverableCreateCall = prisma.deliverables.create.mock.calls[0] as [
      { data: { type: string; title: string; status: string } },
    ];
    expect(deliverableCreateCall[0].data.type).toBe('PLAN_DE_TRABAJO');
    expect(deliverableCreateCall[0].data.title).toBe(
      'Plan de Trabajo (Prórroga de Vigencia)',
    );
    expect(deliverableCreateCall[0].data.status).toBe('SOLICITADO');
  });

  it('exige N° de resolución obligatorio al registrar cualquier adenda', async () => {
    prisma.adendas.findUnique.mockResolvedValue({
      id: 6n,
      agreement_id: 1n,
      correlative: 1,
      type: 'ADENDA_MODIFICACION',
      status: 'EN_OPINIONES',
      agreements: {
        id: 1n,
        tramite_code: '001-2025',
        created_at: new Date('2025-02-01'),
        process_status: 'EN_SEGUIMIENTO',
        start_date: new Date('2025-02-01'),
        end_date: new Date('2026-02-01'),
      },
      opinion_requests: [{ id: 100n, status: 'VALIDADA' }],
    });

    const fakeFile = {
      originalname: 'adenda-01.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
      size: 8,
    };

    await expect(
      service.registerAdenda(6, { resolution_number: '   ' }, fakeFile, 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('en ADENDA_MODIFICACION permite omitir fecha de ampliación pero siempre crea nuevo Plan de Trabajo', async () => {
    prisma.adendas.findUnique.mockResolvedValue({
      id: 7n,
      agreement_id: 1n,
      correlative: 2,
      type: 'ADENDA_MODIFICACION',
      status: 'EN_OPINIONES',
      agreements: {
        id: 1n,
        tramite_code: '001-2025',
        created_at: new Date('2025-02-01'),
        process_status: 'EN_SEGUIMIENTO',
        start_date: new Date('2025-02-01'),
        end_date: new Date('2026-02-01'),
      },
      opinion_requests: [{ id: 101n, status: 'VALIDADA' }],
    });
    prisma.document_types.findUnique.mockResolvedValue({ id: 99n });
    prisma.adendas.update.mockResolvedValue({ id: 7n, status: 'REGISTRADA' });

    const fakeFile = {
      originalname: 'adenda-02.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
      size: 8,
    };

    await service.registerAdenda(
      7,
      { resolution_number: 'RR-200-2026' },
      fakeFile,
      1,
    );

    expect(prisma.agreements.update).not.toHaveBeenCalled();
    const deliverableCreateCall = prisma.deliverables.create.mock.calls[0] as [
      { data: { type: string; title: string; status: string } },
    ];
    expect(deliverableCreateCall[0].data.title).toBe(
      'Plan de Trabajo (Modificación y Ampliación)',
    );
  });

  it('lanza NotFoundException al consultar adendas de un convenio inexistente', async () => {
    prisma.agreements.findUnique.mockResolvedValue(null);
    await expect(service.getAdendas(999)).rejects.toThrow(NotFoundException);
  });
});
