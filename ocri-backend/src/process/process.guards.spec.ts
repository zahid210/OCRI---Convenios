import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProcessService } from './process.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { PdfMergerService } from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';

const baseAgreement = {
  id: 1n,
  process_status: 'OPINIONES_COMPLETAS',
  tramite_code: 'TR-001',
  stage: 'ETAPA_1_PROPUESTA',
  created_at: new Date('2026-01-01'),
};

describe('ProcessService · guardas de expediente', () => {
  let service: ProcessService;
  let opinions: Array<{ status: string }>;
  let documentRows: Array<{ document_types: { code: string | null } | null }>;
  let agreementStatus: string;

  beforeEach(async () => {
    opinions = [];
    documentRows = [];
    agreementStatus = 'OPINIONES_COMPLETAS';

    const tx = {
      documents: { create: jest.fn(() => Promise.resolve({ id: 1n })) },
      process_events: { create: jest.fn(() => Promise.resolve({})) },
      agreements: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 1n,
            process_status: agreementStatus,
            stage: 'ETAPA_2_REGISTRO',
          }),
        ),
        update: jest.fn(() => Promise.resolve({})),
      },
    };

    const prisma = {
      agreements: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            ...baseAgreement,
            process_status: agreementStatus,
          }),
        ),
      },
      opinion_requests: {
        findMany: jest.fn(() => Promise.resolve(opinions)),
      },
      documents: {
        findMany: jest.fn(() => Promise.resolve(documentRows)),
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(() => Promise.resolve({ id: 1n })),
      },
      document_types: {
        findFirst: jest.fn(() => Promise.resolve({ id: 1n })),
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
        {
          provide: PdfMergerService,
          useValue: {
            mergeOpinionResponses: jest.fn(() => Promise.resolve('x/m.pdf')),
          },
        },
        { provide: StorageService, useValue: {} },
      ],
    }).compile();

    service = module.get(ProcessService);
  });

  it('generateExpediente lanza si no hay solicitudes de opinión', async () => {
    await expect(service.generateExpediente(1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.generateExpediente(1)).rejects.toThrow(
      'No hay solicitudes de opinión generadas',
    );
  });

  it('generateExpediente lanza si hay opiniones sin resolver', async () => {
    opinions = [{ status: 'RESPONDIDA' }];

    await expect(service.generateExpediente(1)).rejects.toThrow(
      'No se puede generar el expediente',
    );
  });

  it('generateExpediente procede cuando todas están resueltas', async () => {
    opinions = [{ status: 'VALIDADA' }, { status: 'CANCELADA' }];

    await expect(service.generateExpediente(1)).resolves.toBeDefined();
  });

  it('finalizeExpediente lanza si hay opiniones sin resolver', async () => {
    opinions = [{ status: 'ENVIADA' }];

    await expect(service.finalizeExpediente(1)).rejects.toThrow(
      'No se puede concluir el expediente técnico',
    );
  });

  it('sendToRectorado lanza si faltan documentos obligatorios', async () => {
    agreementStatus = 'EXPEDIENTE_TECNICO_LISTO';
    documentRows = [{ document_types: { code: 'EXPEDIENTE_TECNICO' } }];

    await expect(service.sendToRectorado(1)).rejects.toThrow(
      'Faltan documentos obligatorios para remitir a Rectorado',
    );
  });

  it('sendToRectorado procede cuando están todos los documentos', async () => {
    agreementStatus = 'EXPEDIENTE_TECNICO_LISTO';
    documentRows = [
      { document_types: { code: 'EXPEDIENTE_TECNICO' } },
      { document_types: { code: 'PROPUESTA_CONVENIO_FIRMA' } },
      { document_types: { code: 'OFICIO_RESPUESTA_RECTORADO' } },
    ];

    await expect(service.sendToRectorado(1)).resolves.toBeDefined();
  });
});
