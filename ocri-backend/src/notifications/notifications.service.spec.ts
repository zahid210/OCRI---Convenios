import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { VIEWER_VISIBLE_STATUSES } from '../common/visibility';

/**
 * Regresión de la auditoría de /notifications: los ack solo afectan al
 * propio usuario (no-IDOR), el persist era read→insert en dos pasos y dos
 * acks simultáneos podían reventar el @unique([user_id,key]) en P2002 (500);
 * ahora es idempotente vía createMany(skipDuplicates).
 */
describe('NotificationsService', () => {
  let service: NotificationsService;

  let ackKeys: string[] = [];

  const prisma = {
    agreements: { findMany: jest.fn() },
    notification_acknowledgements: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
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

  const convenio = (id: number, over: Record<string, unknown> = {}) => ({
    id: BigInt(id),
    tramite_code: `T-${id}`,
    title: `Convenio ${id}`,
    resolution_number: null,
    end_date: null,
    ...over,
  });

  const conOpiniones = (
    id: number,
    requests: Array<Record<string, unknown>>,
  ) => ({
    id: BigInt(id),
    tramite_code: `T-${id}`,
    title: `Opinión ${id}`,
    resolution_number: null,
    opinion_requests: requests,
  });

  /** Argumento del último createMany (tipado, sin accesos any). */
  const ultimaLlamadaCreateMany = ():
    | {
        data: Array<{ key: string; user_id: bigint; read_at: Date }>;
        skipDuplicates?: boolean;
      }
    | undefined => {
    const calls = prisma.notification_acknowledgements.createMany.mock
      .calls as Array<
      [
        {
          data: Array<{ key: string; user_id: bigint; read_at: Date }>;
          skipDuplicates?: boolean;
        },
      ]
    >;
    return calls[calls.length - 1]?.[0];
  };

  /** Claves que se pasaron al último createMany. */
  const dataInsertados = (): Array<{
    key: string;
    user_id: bigint;
    read_at: Date;
  }> => ultimaLlamadaCreateMany()?.data ?? [];

  /** Rutea las tres consultas derivadas según la forma del where. */
  const mockQueries = (
    expiring: Array<Record<string, unknown>>,
    expired: Array<Record<string, unknown>>,
    opinions: Array<Record<string, unknown>>,
  ) => {
    prisma.agreements.findMany.mockImplementation(
      (args: { where: Record<string, unknown> }) => {
        const where = args.where;
        if (where.OR) return Promise.resolve(expired);
        if (where.opinion_requests) return Promise.resolve(opinions);
        return Promise.resolve(expiring);
      },
    );
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ackKeys = [];

    // Persistencia en memoria: createMany/deleteMany actualizan ackKeys para
    // que findAll vea lo ya reconocido (como el @unique en la BD).
    prisma.notification_acknowledgements.findMany.mockImplementation(() =>
      Promise.resolve(ackKeys.map((key) => ({ key }))),
    );
    prisma.notification_acknowledgements.createMany.mockImplementation(
      ({ data }: { data: Array<{ key: string }> }) => {
        ackKeys = [...new Set([...ackKeys, ...data.map((d) => d.key)])];
        return Promise.resolve({ count: data.length });
      },
    );
    prisma.notification_acknowledgements.deleteMany.mockImplementation(() => {
      ackKeys = [];
      return Promise.resolve({ count: 0 });
    });

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('findAll', () => {
    it('deriva notificaciones con ranking vencidos→por vencer→pendientes', async () => {
      mockQueries(
        [convenio(1, { end_date: enDias(30) })],
        [convenio(2, { end_date: enDias(-5) })],
        [
          conOpiniones(3, [
            {
              status: 'EN_CURSO',
              due_at: enDias(-2),
              dependencias: { name: 'VRI' },
            },
            {
              status: 'VALIDADA',
              due_at: enDias(-1),
              dependencias: { name: 'OCRI' },
            },
          ]),
        ],
      );

      const r = await service.findAll(7);

      expect(r.total).toBe(3);
      expect(r.items.map((i) => i.id)).toEqual([
        'expired-2',
        'expiring-1',
        'pending_area-3',
      ]);
      expect(r.items.find((i) => i.id === 'expired-2')).toMatchObject({
        type: 'expired',
        message: 'Convenio vencido',
      });
      expect(r.items.find((i) => i.id === 'expiring-1')).toMatchObject({
        agreement_id: 1,
        type: 'expiring',
        dias_restantes: 30,
        message: 'Próximo a vencer en 30 día(s)',
      });
      expect(r.items.find((i) => i.id === 'pending_area-3')?.message).toContain(
        '1 opinión(es) con plazo vencido: VRI',
      );
    });

    it('excluye las claves ya reconocidas por el usuario', async () => {
      mockQueries([convenio(1, { end_date: enDias(30) })], [], []);
      ackKeys = ['expiring-1'];

      const r = await service.findAll(7);

      expect(r.total).toBe(0);
      expect(r.items).toEqual([]);
    });

    it('limita la lista visible a 25 ítems sin truncar el total', async () => {
      const muchas = Array.from({ length: 30 }, (_, i) =>
        convenio(i + 1, { end_date: enDias(30 + i) }),
      );
      mockQueries(muchas, [], []);

      const r = await service.findAll(7);

      expect(r.total).toBe(30);
      expect(r.items.length).toBe(25);
    });
  });

  describe('acknowledge', () => {
    it('persiste con skipDuplicates (idempotente ante acks simultáneos)', async () => {
      mockQueries([convenio(1, { end_date: enDias(30) })], [], []);

      const r = await service.acknowledge(7, ['expiring-1']);

      expect(ultimaLlamadaCreateMany()?.skipDuplicates).toBe(true);
      expect(dataInsertados()[0]).toMatchObject({
        user_id: 7n,
        key: 'expiring-1',
      });
      expect(dataInsertados()[0].read_at).toBeInstanceOf(Date);
      expect(r).toEqual({ pending: 0 });
    });

    it('nunca persiste claves de otro usuario (sin IDOR)', async () => {
      mockQueries([], [], []);

      await service.acknowledge(9, ['expiring-1']);
      const data = dataInsertados();

      expect(data).toHaveLength(1);
      expect(data.every((d) => d.user_id === 9n)).toBe(true);
    });

    it('rechaza sin usuario, sin claves o todas inválidas', async () => {
      mockQueries([], [], []);

      await expect(service.acknowledge(0, ['x'])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acknowledge(7, [])).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acknowledge(7, ['   '])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('descarta claves con más de 120 chars en llamadas internas', async () => {
      mockQueries([convenio(1, { end_date: enDias(30) })], [], []);

      await service.acknowledge(7, ['expiring-1', 'x'.repeat(200)]);

      expect(dataInsertados()).toEqual([
        expect.objectContaining({ key: 'expiring-1', user_id: 7n }),
      ]);
    });
  });

  describe('readAll / resetRead', () => {
    it('readAll marca todas las claves actuales y recalcula', async () => {
      mockQueries(
        [convenio(1, { end_date: enDias(30) })],
        [convenio(2, { end_date: enDias(-5) })],
        [],
      );

      const r = await service.readAll(7);

      expect(
        dataInsertados()
          .map((d) => d.key)
          .sort(),
      ).toEqual(['expired-2', 'expiring-1']);
      expect(r).toEqual({ pending: 0 });
    });

    it('resetRead borra solo los acknowledgements del usuario', async () => {
      mockQueries([convenio(1, { end_date: enDias(30) })], [], []);
      ackKeys = ['expiring-1'];

      const r = await service.resetRead(7);

      expect(
        prisma.notification_acknowledgements.deleteMany,
      ).toHaveBeenCalledWith({ where: { user_id: 7n } });
      expect(r).toEqual({ pending: 1 });
    });

    it('readAll sin notificaciones devuelve pending 0 sin persistir', async () => {
      mockQueries([], [], []);

      const r = await service.readAll(7);

      expect(
        prisma.notification_acknowledgements.createMany,
      ).not.toHaveBeenCalled();
      expect(r).toEqual({ pending: 0 });
    });
  });

  describe('confinamiento por rol (Fase 5 · H5.2)', () => {
    const llamadas = () =>
      prisma.agreements.findMany.mock.calls as Array<
        [{ where: Record<string, unknown> }]
      >;

    it('el viewer no consulta propuestas en etapas internas', async () => {
      mockQueries([], [], []);

      await service.findAll(7, 'viewer');

      const conOpinionesArgs = llamadas().find(
        ([a]) => a.where.opinion_requests,
      );
      expect(conOpinionesArgs).toBeDefined();
      expect(conOpinionesArgs?.[0].where.process_status).toEqual({ in: [] });
    });

    it('el viewer acota expiring/expired a los estados visibles', async () => {
      mockQueries([], [], []);

      await service.findAll(7, 'viewer');

      const porVencer = llamadas().find(
        ([a]) => !a.where.OR && !a.where.opinion_requests,
      );
      const vencidos = llamadas().find(([a]) => a.where.OR);

      expect(porVencer?.[0].where.process_status).toEqual({
        in: [...VIEWER_VISIBLE_STATUSES],
      });
      expect(vencidos?.[0].where.process_status).toEqual({
        in: [...VIEWER_VISIBLE_STATUSES],
      });
    });

    it('un rol de operación no recibe restricción de estado', async () => {
      mockQueries(
        [convenio(1, { end_date: enDias(30) })],
        [convenio(2, { end_date: enDias(-5) })],
        [conOpiniones(3, [])],
      );

      await service.findAll(7, 'admin');

      // expiring (sin OR) y expired (con OR) no llevan filtro de rol...
      const porVencer = llamadas().find(
        ([a]) => !a.where.OR && !a.where.opinion_requests,
      );
      const vencidos = llamadas().find(([a]) => a.where.OR);
      expect(porVencer?.[0].where.process_status).toBeUndefined();
      expect(vencidos?.[0].where.process_status).toBeUndefined();

      // ...y la consulta de opiniones mantiene su filtro base en trámite.
      const opiniones = llamadas().find(([a]) => a.where.opinion_requests);
      expect(opiniones?.[0].where.process_status).toEqual({
        in: ['RECEPCIONADA', 'OPINIONES_EN_CURSO', 'OPINIONES_COMPLETAS'],
      });
    });

    it('readAll del viewer tampoco persiste avisos de etapas internas', async () => {
      mockQueries([], [], []);

      const r = await service.readAll(7, 'viewer');

      expect(r).toEqual({ pending: 0 });
    });
  });
});
