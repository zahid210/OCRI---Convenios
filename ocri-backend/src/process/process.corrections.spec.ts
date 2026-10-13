import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProcessService } from './process.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { PdfMergerService } from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';

const file = {
  originalname: 'corregido.pdf',
  buffer: Buffer.from('%PDF-1.4'),
} as never;

function agreementWith(status: string) {
  return {
    id: 1n,
    process_status: status,
    tramite_code: '999-2026',
    stage: 'ETAPA_1_PROPUESTA',
    created_at: new Date('2026-01-01'),
  };
}

describe('ProcessService · replaceProcessDocument', () => {
  let service: ProcessService;
  let prisma: {
    agreements: { findUnique: jest.Mock };
    documents: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    documents: { update: jest.Mock; deleteMany: jest.Mock };
    process_events: { create: jest.Mock };
  };
  let putUnique: jest.Mock;
  let removeRel: jest.Mock;
  let logEvent: jest.SpyInstance;

  const target = {
    id: 7n,
    opinion_request_id: null,
    file_path: '2026/999-2026/dictamen.pdf',
    original_name: 'dictamen.pdf',
    name: 'Dictamen',
    document_types: { code: 'DICTAMEN', name: 'Dictamen' },
  };

  beforeEach(async () => {
    putUnique = jest.fn(() => Promise.resolve('2026/999-2026/nuevo.pdf'));
    removeRel = jest.fn(() => Promise.resolve());
    tx = {
      documents: {
        update: jest.fn(() => Promise.resolve({})),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
      process_events: { create: jest.fn(() => Promise.resolve({})) },
    };

    prisma = {
      agreements: {
        findUnique: jest.fn(() =>
          Promise.resolve(agreementWith('RECEPCIONADA')),
        ),
      },
      documents: {
        findFirst: jest.fn(() => Promise.resolve({ ...target })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUniqueOrThrow: jest.fn(() =>
          Promise.resolve({
            ...target,
            file_path: '2026/999-2026/nuevo.pdf',
          }),
        ),
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
        { provide: StorageService, useValue: { putUnique, removeRel } },
      ],
    }).compile();

    service = module.get(ProcessService);
    logEvent = jest
      .spyOn(
        service as unknown as { logEvent: () => Promise<void> },
        'logEvent',
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => logEvent.mockRestore());

  it('permite reemplazar documentos aunque el trámite ya salió de Etapa 1', async () => {
    prisma.agreements.findUnique.mockResolvedValueOnce(
      agreementWith('ENVIADO_A_RECTORADO'),
    );

    await service.replaceProcessDocument(1, 7, file, {});

    expect(tx.documents.update).toHaveBeenCalledTimes(1);
    expect(putUnique).toHaveBeenCalled();
  });

  it('rechaza un documento que no pertenece al trámite', async () => {
    prisma.documents.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.replaceProcessDocument(1, 999, file, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza los oficios de opinión (se corrigen desde la solicitud)', async () => {
    prisma.documents.findFirst.mockResolvedValueOnce({
      ...target,
      opinion_request_id: 3n,
      document_types: { code: 'OFICIO_SOLICITUD_OPINION', name: 'Oficio' },
    });

    await expect(
      service.replaceProcessDocument(1, 7, file, {}),
    ).rejects.toThrow(/Cambiar Oficio/);
    expect(putUnique).not.toHaveBeenCalled();
  });

  it('rechaza los documentos generados por el sistema (expediente)', async () => {
    prisma.documents.findFirst.mockResolvedValueOnce({
      ...target,
      document_types: { code: 'EXPEDIENTE_TECNICO', name: 'Expediente' },
    });

    await expect(
      service.replaceProcessDocument(1, 7, file, {}),
    ).rejects.toThrow(/Regenerar/);
    expect(putUnique).not.toHaveBeenCalled();
  });

  it('reemplaza la fila, colapsa duplicados y purga los archivos viejos', async () => {
    prisma.documents.findMany.mockResolvedValueOnce([
      { id: 8n, file_path: '2026/999-2026/dictamen(1).pdf' },
    ]);

    await service.replaceProcessDocument(1, 7, file, {});

    expect(tx.documents.update).toHaveBeenCalledTimes(1);
    expect(tx.documents.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [8n] } },
    });
    // El objeto original y el duplicado se purgan tras el commit.
    expect(removeRel).toHaveBeenCalledWith('2026/999-2026/dictamen.pdf');
    expect(removeRel).toHaveBeenCalledWith('2026/999-2026/dictamen(1).pdf');
    const calls = logEvent.mock.calls as unknown as Array<[bigint, string]>;
    expect(calls[0][1]).toBe('DOCUMENTO_REEMPLAZADO');
  });

  it('purga el archivo nuevo si la transacción falla (sin dejar huérfanos)', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('db caída'));

    await expect(
      service.replaceProcessDocument(1, 7, file, {}),
    ).rejects.toThrow('db caída');
    expect(removeRel).toHaveBeenCalledWith('2026/999-2026/nuevo.pdf');
  });
});

describe('ProcessService · uploadProcessDocument (idempotencia por tipo)', () => {
  let service: ProcessService;
  let prisma: {
    agreements: { findUnique: jest.Mock };
    document_types: { findUnique: jest.Mock };
    documents: { findFirst: jest.Mock };
  };
  let putUnique: jest.Mock;

  beforeEach(async () => {
    putUnique = jest.fn(() => Promise.resolve('2026/999-2026/x.pdf'));

    prisma = {
      agreements: {
        findUnique: jest.fn(() =>
          Promise.resolve(agreementWith('RECEPCIONADA')),
        ),
      },
      document_types: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: 5n,
            code: 'DICTAMEN',
            name: 'Dictamen',
            direction: 'ENTRADA',
          }),
        ),
      },
      documents: {
        findFirst: jest.fn(() => Promise.resolve({ id: 7n })),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ProcessService,
        { provide: PrismaService, useValue: prisma },
        { provide: AppConfigService, useValue: {} },
        { provide: PdfMergerService, useValue: {} },
        { provide: StorageService, useValue: { putUnique } },
      ],
    }).compile();

    service = module.get(ProcessService);
  });

  it('rechaza cargar un tipo que ya existe (evita duplicados)', async () => {
    await expect(
      service.uploadProcessDocument(1, file, {
        document_type_code: 'DICTAMEN',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(putUnique).not.toHaveBeenCalled();
  });
});

describe('ProcessService · respondOpinionRequest (corrección RESPONDIDA)', () => {
  let service: ProcessService;
  let prisma: {
    opinion_requests: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
    };
    documents: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    process_events: { count: jest.Mock };
    document_types: { findUnique: jest.Mock };
    agreements: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let putUnique: jest.Mock;
  let removeRel: jest.Mock;
  let logEvent: jest.SpyInstance;

  const baseRequest = (status: string, processStatus = 'RECEPCIONADA') => ({
    id: 3n,
    agreement_id: 1n,
    status,
    response_date: new Date('2026-02-01'),
    validated_at: null,
    observations: null,
    agreements: {
      id: 1n,
      process_status: processStatus,
      tramite_code: '999-2026',
      created_at: new Date('2026-01-01'),
    },
    dependencias: { name: 'ASEL' },
  });

  function buildService(status: string, respuestasPrevias = 1) {
    prisma.opinion_requests.findUnique.mockResolvedValue(baseRequest(status));
    prisma.documents.findMany.mockResolvedValue(
      Array.from({ length: respuestasPrevias }, (_, i) => ({
        id: BigInt(10 + i),
        file_path: `2026/999-2026/respuesta(${i}).pdf`,
      })),
    );
    prisma.process_events.count.mockResolvedValue(0);
    prisma.opinion_requests.findUniqueOrThrow.mockResolvedValue(
      baseRequest('RESPONDIDA'),
    );
    prisma.opinion_requests.updateMany.mockResolvedValue({ count: 1 });
    prisma.opinion_requests.findMany.mockResolvedValue([
      { status: 'RESPONDIDA' },
    ]);
    prisma.agreements.findUnique.mockResolvedValue({
      process_status: 'OPINIONES_EN_CURSO',
    });
  }

  beforeEach(async () => {
    putUnique = jest.fn(() =>
      Promise.resolve('2026/999-2026/respuesta-nueva.pdf'),
    );
    removeRel = jest.fn(() => Promise.resolve());

    prisma = {
      opinion_requests: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
      documents: {
        findMany: jest.fn(),
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        create: jest.fn(() => Promise.resolve({})),
      },
      process_events: { count: jest.fn() },
      document_types: {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 6n, code: 'OFICIO_RESPUESTA_OPINION' }),
        ),
      },
      agreements: { findUnique: jest.fn() },
      $transaction: jest.fn(
        (fn: (t: any) => Promise<unknown>): Promise<unknown> => fn(prisma),
      ),
    };

    buildService('ENVIADA', 0);

    const module = await Test.createTestingModule({
      providers: [
        ProcessService,
        { provide: PrismaService, useValue: prisma },
        { provide: AppConfigService, useValue: {} },
        { provide: PdfMergerService, useValue: {} },
        { provide: StorageService, useValue: { putUnique, removeRel } },
      ],
    }).compile();

    service = module.get(ProcessService);
    logEvent = jest
      .spyOn(
        service as unknown as { logEvent: () => Promise<void> },
        'logEvent',
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => logEvent.mockRestore());

  it('registra la primera respuesta sin tocar documentos previos', async () => {
    await service.respondOpinionRequest(3, {}, file, 1);

    expect(prisma.documents.deleteMany).not.toHaveBeenCalled();
    const calls = logEvent.mock.calls as unknown as Array<[bigint, string]>;
    expect(calls[0][1]).toBe('RESPUESTA_REGISTRADA');
  });

  it('aplica la enmienda desde OBSERVADA y registra RESPUESTA_CORREGIDA', async () => {
    buildService('OBSERVADA', 1);

    await service.respondOpinionRequest(
      3,
      { observations: 'corregida' },
      file,
      1,
    );

    expect(prisma.documents.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10n] } },
    });
    const calls = logEvent.mock.calls as unknown as Array<[bigint, string]>;
    expect(calls[0][1]).toBe('RESPUESTA_CORREGIDA');
  });

  it('reemplaza una respuesta RESPONDIDA sin borrar el oficio de solicitud', async () => {
    buildService('RESPONDIDA', 1);

    await service.respondOpinionRequest(3, {}, file, 1);

    // La consulta de documentos previos SOLO apunta a la respuesta, nunca al
    // oficio de solicitud: el filtro lo garantiza.
    expect(prisma.documents.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          document_types: { code: 'OFICIO_RESPUESTA_OPINION' },
        }),
      }),
    );
    expect(prisma.documents.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10n] } },
    });

    // La respuesta anterior se purga en OBS después del commit.
    expect(removeRel).toHaveBeenCalledWith('2026/999-2026/respuesta(0).pdf');

    const calls = logEvent.mock.calls as unknown as Array<[bigint, string]>;
    expect(calls[0][1]).toBe('RESPUESTA_REEMPLAZADA');
  });

  it('permite corregir la respuesta aunque el trámite ya fue remitido a Rectorado', async () => {
    buildService('RESPONDIDA', 1);
    prisma.opinion_requests.findUnique.mockResolvedValue(
      baseRequest('RESPONDIDA', 'ENVIADO_A_RECTORADO'),
    );

    await service.respondOpinionRequest(3, {}, file, 1);

    expect(prisma.documents.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [10n] } },
    });
    expect(putUnique).toHaveBeenCalled();
  });
});
