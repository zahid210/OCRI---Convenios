import { Test } from '@nestjs/testing';
import { ProcessService } from './process.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { PdfMergerService } from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';

const requestRow = {
  id: 7n,
  agreement_id: 1n,
  status: 'GENERADA',
  dependencias: { name: 'Dependencia X' },
};

describe('ProcessService · avance a OPINIONES_COMPLETAS', () => {
  let service: ProcessService;
  let statuses: Array<{ status: string }>;
  let agreementStatus: string;
  let agreementUpdates: Array<Record<string, unknown>>;
  let findManyArgs: Record<string, unknown> | undefined;

  beforeEach(async () => {
    statuses = [];
    agreementStatus = 'OPINIONES_EN_CURSO';
    agreementUpdates = [];
    findManyArgs = undefined;

    const tx = {
      opinion_requests: {
        update: jest.fn(() => Promise.resolve({ id: 7n, status: 'CANCELADA' })),
        findMany: jest.fn((args: Record<string, unknown>) => {
          findManyArgs = args;
          return Promise.resolve(statuses);
        }),
      },
      agreements: {
        findUnique: jest.fn(() =>
          Promise.resolve({ process_status: agreementStatus }),
        ),
        update: jest.fn((args: Record<string, unknown>) => {
          agreementUpdates.push(args);
          return Promise.resolve({});
        }),
      },
      process_events: { create: jest.fn(() => Promise.resolve({})) },
    };

    const prisma = {
      opinion_requests: {
        findUnique: jest.fn(() => Promise.resolve({ ...requestRow })),
      },
      $transaction: jest.fn(
        (fn: (t: typeof tx) => Promise<unknown>): Promise<unknown> => fn(tx),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        ProcessService,
        { provide: PrismaService, useValue: prisma },
        { provide: AppConfigService, useValue: {} },
        { provide: PdfMergerService, useValue: {} },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    service = module.get(ProcessService);
  });

  it('avanza a OPINIONES_COMPLETAS cuando todas quedaron validadas/canceladas', async () => {
    statuses = [{ status: 'CANCELADA' }, { status: 'VALIDADA' }];

    await service.cancelOpinionRequest(7, 3);

    expect(agreementUpdates).toHaveLength(1);
    const updateData = agreementUpdates[0].data as { process_status?: string };
    expect(updateData.process_status).toBe('OPINIONES_COMPLETAS');
    expect(findManyArgs).toEqual(
      expect.objectContaining({ select: { status: true } }),
    );
  });

  it('no avanza si aún hay opiniones pendientes', async () => {
    statuses = [{ status: 'CANCELADA' }, { status: 'ENVIADA' }];

    await service.cancelOpinionRequest(7, 3);

    expect(agreementUpdates).toHaveLength(0);
  });

  it('es no-op si el proceso ya está en OPINIONES_COMPLETAS', async () => {
    statuses = [{ status: 'VALIDADA' }];
    agreementStatus = 'OPINIONES_COMPLETAS';

    await service.cancelOpinionRequest(7, 3);

    expect(agreementUpdates).toHaveLength(0);
  });
});
