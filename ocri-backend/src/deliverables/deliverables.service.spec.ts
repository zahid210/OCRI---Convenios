import { Test } from '@nestjs/testing';
import { DeliverablesService } from './deliverables.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { PdfMergerService } from '../common/pdf-merger.service';

/** Convenio mínimo para poblar la plantilla de solicitud. */
function agreementRow(processStatus = 'ETAPA_3') {
  return {
    id: 1n,
    process_status: processStatus,
    tramite_code: '013-2025',
    title: 'Convenio de prueba',
    created_at: new Date('2025-03-01T00:00:00Z'),
    institutions: { name: 'UNCP' },
    responsables: [],
  };
}

function deliverableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10n,
    agreement_id: 1n,
    type: 'PLAN_DE_TRABAJO',
    title: 'Plan de Trabajo',
    status: 'SOLICITADO',
    period: null,
    version: 1,
    agreements: agreementRow(),
    ...overrides,
  };
}

/** `$transaction` que ejecuta el callback con el mismo mock como `tx`. */
function txRunner(prisma: Record<string, unknown>) {
  return (cb: (tx: unknown) => unknown) => Promise.resolve(cb(prisma));
}

describe('DeliverablesService', () => {
  let service: DeliverablesService;

  beforeEach(async () => {
    const prisma = { $transaction: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        DeliverablesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: {} },
        {
          provide: PdfMergerService,
          useValue: {
            getOficioOpinionAssets: jest.fn(() => ({
              logoIzq: '',
              logoDer: '',
            })),
            getOficioSignatureStamp: jest.fn(() => ''),
            getOficioOpinionTemplateCss: jest.fn(() => ''),
            renderOficioOpinionPdf: jest.fn(() => '2025/013-2025/x.pdf'),
          },
        },
      ],
    }).compile();
    service = module.get(DeliverablesService);
  });

  // ─── B7-1 · Confinamiento de la plantilla por rol ──────────────────────────

  describe('getRequestDocumentTemplate · confinamiento por rol (B7-1)', () => {
    it('responde 404 al rol viewer sobre un convenio en trámite', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(
            deliverableRow({ agreements: agreementRow('ETAPA_3') }),
          ),
        ),
      };

      await expect(
        service.getRequestDocumentTemplate(10, 'viewer'),
      ).rejects.toThrow('Entregable no encontrado');
    });

    it('permite al rol viewer la plantilla de un convenio formalizado', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(
            deliverableRow({ agreements: agreementRow('PUBLICADO') }),
          ),
        ),
      };

      const result = await service.getRequestDocumentTemplate(10, 'viewer');
      expect(result.oficio_number).toContain('PLAN');
    });

    it('permite a un rol operativo la plantilla de un convenio en trámite', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(
            deliverableRow({ agreements: agreementRow('ETAPA_3') }),
          ),
        ),
      };

      const result = await service.getRequestDocumentTemplate(10, 'procesador');
      expect(result.oficio_number).toContain('PLAN');
    });
  });

  // ─── B7-6 · Año del N° de oficio derivado del convenio ─────────────────────

  describe('N° de oficio · año derivado del convenio (B7-6)', () => {
    it('usa el año del tramite_code aunque el reloj del servidor sea otro', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(
            deliverableRow({
              agreements: {
                ...agreementRow('PUBLICADO'),
                tramite_code: '013-2021',
              },
            }),
          ),
        ),
      };

      const result = await service.getRequestDocumentTemplate(10, 'admin');
      // El oficio se numera con el año del convenio (2021), no con el actual.
      expect(result.oficio_number).toContain('2021');
    });
  });

  // ─── B7-2 · Tope de observaciones ──────────────────────────────────────────

  describe('evaluateDeliverable · tope de observaciones (B7-2)', () => {
    it('rechaza observar cuando ya se alcanzó el máximo', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(deliverableRow({ status: 'RECIBIDO' })),
        ),
        findUniqueOrThrow: jest.fn(),
      };
      prisma.agreements = {
        findUnique: jest.fn(() =>
          Promise.resolve({ process_status: 'EN_SEGUIMIENTO' }),
        ),
      };
      const deliverableObservations = {
        count: jest.fn(() => Promise.resolve(3)),
        create: jest.fn(),
      };
      prisma.deliverable_observations = deliverableObservations;
      const tx = {
        deliverables: prisma.deliverables,
        deliverable_observations: deliverableObservations,
        agreements: prisma.agreements,
        process_events: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(txRunner(tx));

      await expect(
        service.evaluateDeliverable(10, 'OBSERVED', 'corregir algo', 1),
      ).rejects.toThrow('máximo de 3 observaciones');

      expect(deliverableObservations.create).not.toHaveBeenCalled();
    });

    it('permite observar por debajo del máximo', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.deliverables = {
        findUnique: jest.fn(() =>
          Promise.resolve(deliverableRow({ status: 'RECIBIDO' })),
        ),
        findUniqueOrThrow: jest.fn(() =>
          Promise.resolve(deliverableRow({ status: 'OBSERVADO' })),
        ),
        update: jest.fn(() => Promise.resolve({})),
      };
      prisma.agreements = {
        findUnique: jest.fn(() =>
          Promise.resolve({ process_status: 'EN_SEGUIMIENTO' }),
        ),
      };
      const deliverableObservations = {
        count: jest.fn(() => Promise.resolve(1)),
        create: jest.fn(() => Promise.resolve({})),
      };
      prisma.deliverable_observations = deliverableObservations;
      const tx = {
        deliverables: prisma.deliverables,
        deliverable_observations: deliverableObservations,
        agreements: prisma.agreements,
        process_events: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(txRunner(tx));

      await service.evaluateDeliverable(10, 'OBSERVED', 'corregir algo', 1);

      expect(deliverableObservations.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─── B7-7 · Re-solicitud de un Plan ya registrado ──────────────────────────

  describe('requestWorkPlan · Plan ya registrado (B7-7)', () => {
    it('rechaza volver a solicitar un Plan ya REGISTRADO', async () => {
      const prisma = (service as unknown as { prisma: Record<string, unknown> })
        .prisma;
      prisma.agreements = {
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 1n, process_status: 'EN_SEGUIMIENTO' }),
        ),
      };
      const tx = {
        deliverables: {
          findFirst: jest.fn(() =>
            Promise.resolve({ id: 10n, status: 'REGISTRADO' }),
          ),
          create: jest.fn(),
        },
        agreements: { update: jest.fn() },
        process_events: { create: jest.fn() },
      };
      prisma.$transaction = jest.fn(txRunner(tx));

      await expect(service.requestWorkPlan(1, 1)).rejects.toThrow(
        'ya fue registrado',
      );
      expect(tx.deliverables.create).not.toHaveBeenCalled();
    });
  });
});
