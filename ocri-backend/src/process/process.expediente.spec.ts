import { Test } from '@nestjs/testing';
import { ProcessService } from './process.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../app-config/app-config.service';
import { PdfMergerService } from '../common/pdf-merger.service';
import { StorageService } from '../common/storage/storage.service';

/**
 * Cubre el reemplazo del expediente técnico al regenerarlo.
 *
 * El orden de las operaciones importa: el merge debe ocurrir antes de borrar
 * el objeto anterior. Si se invierte y el merge falla (OBS caído, PDF
 * corrupto), el convenio se queda sin expediente y sin copia recuperable.
 */
describe('ProcessService · generateExpediente (reemplazo)', () => {
  let service: ProcessService;

  let mergeOpinionResponses: jest.Mock;
  let removeRel: jest.Mock;
  let documentsDelete: jest.Mock;
  let documentsCreate: jest.Mock;
  let existingDoc: { id: bigint; file_path: string } | null;
  let logEvent: jest.SpyInstance;

  const agreement = {
    id: 1n,
    process_status: 'OPINIONES_COMPLETAS',
    tramite_code: '999-2026',
    stage: 'ETAPA_1_PROPUESTA',
    created_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    existingDoc = {
      id: 42n,
      file_path: '2026/999-2026/expediente-tecnico.pdf',
    };

    mergeOpinionResponses = jest.fn(() =>
      Promise.resolve('2026/999-2026/expediente-tecnico(1).pdf'),
    );
    removeRel = jest.fn(() => Promise.resolve());
    documentsDelete = jest.fn(() => Promise.resolve({ id: 42n }));
    documentsCreate = jest.fn(() => Promise.resolve({ id: 99n }));

    const tx = {
      documents: { create: documentsCreate, delete: documentsDelete },
      process_events: { create: jest.fn(() => Promise.resolve({})) },
      agreements: { findUnique: jest.fn(() => Promise.resolve(agreement)) },
    };

    const prisma = {
      agreements: {
        findUnique: jest.fn(() => Promise.resolve(agreement)),
      },
      // Todas las opiniones resueltas: la guarda de generateExpediente pasa.
      opinion_requests: {
        findMany: jest.fn(() =>
          Promise.resolve([{ status: 'VALIDADA' }, { status: 'CANCELADA' }]),
        ),
      },
      documents: {
        findMany: jest.fn(() => Promise.resolve([])),
        findFirst: jest.fn(() => Promise.resolve(existingDoc)),
        create: documentsCreate,
        delete: documentsDelete,
      },
      document_types: {
        findFirst: jest.fn(() => Promise.resolve({ id: 5n })),
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
          useValue: { mergeOpinionResponses },
        },
        { provide: StorageService, useValue: { removeRel } },
      ],
    }).compile();

    service = module.get(ProcessService);
    // logEvent escribe en la tabla de eventos; no es foco de estos tests.
    logEvent = jest
      .spyOn(
        service as unknown as { logEvent: () => Promise<void> },
        'logEvent',
      )
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    logEvent.mockRestore();
  });

  it('conserva el expediente anterior si el merge falla', async () => {
    mergeOpinionResponses.mockRejectedValueOnce(new Error('OBS no responde'));

    await expect(service.generateExpediente(1)).rejects.toThrow(
      'OBS no responde',
    );

    // Nada se borra: ni el objeto en OBS ni la fila en la base.
    expect(removeRel).not.toHaveBeenCalled();
    expect(documentsDelete).not.toHaveBeenCalled();
    expect(documentsCreate).not.toHaveBeenCalled();
  });

  it('no borra el objeto anterior hasta que la fila nueva está creada', async () => {
    await service.generateExpediente(1);

    // El merge ocurre antes de cualquier borrado.
    expect(mergeOpinionResponses).toHaveBeenCalledTimes(1);
    expect(documentsCreate).toHaveBeenCalledTimes(1);
    expect(documentsDelete).toHaveBeenCalledWith({ where: { id: 42n } });

    // Y el objeto viejo se purga al final, ya con el nuevo en su sitio.
    expect(removeRel).toHaveBeenCalledWith(
      '2026/999-2026/expediente-tecnico.pdf',
    );
  });

  it('no borra nada cuando no hay expediente previo', async () => {
    existingDoc = null;

    await service.generateExpediente(1);

    expect(removeRel).not.toHaveBeenCalled();
    expect(documentsDelete).not.toHaveBeenCalled();
    expect(documentsCreate).toHaveBeenCalledTimes(1);
  });

  it('un fallo al purgar el objeto antiguo no revierte el expediente nuevo', async () => {
    removeRel.mockRejectedValueOnce(new Error('permiso denegado en OBS'));

    // El error de limpieza es informativo: el nuevo expediente ya está commiteado.
    await expect(service.generateExpediente(1)).resolves.toBeDefined();
    expect(documentsCreate).toHaveBeenCalledTimes(1);
  });

  it('no purga el objeto si la ruta nueva coincide con la anterior', async () => {
    // Blindaje por si el flujo pasara a sobrescribir en lugar de usar putUnique.
    mergeOpinionResponses.mockResolvedValueOnce(
      '2026/999-2026/expediente-tecnico.pdf',
    );

    await service.generateExpediente(1);

    // Misma clave: borrarla destruiría el archivo recién escrito.
    expect(removeRel).not.toHaveBeenCalled();
  });
});
