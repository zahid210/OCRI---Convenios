import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DependenciasService,
  esElegibleParaOpinion,
} from './dependencias.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry, AuditService } from '../audit/audit.service';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';

/**
 * Regresión de la auditoría de /dependencias: antes no había tests y cada
 * regla (kind del query, objetivo por defecto, protección de borrado, seed
 * anti-duplicados) podía romperse sin que nada lo delatara.
 */
describe('DependenciasService', () => {
  let service: DependenciasService;

  const fila = {
    id: 11n,
    code: 'VRI',
    name: 'Vicerrectorado de Investigación',
    kind: 'UNIDAD_ORGANICA',
    email: null,
    is_default_opinion: true,
    sort_order: 3,
    is_active: true,
    created_at: null,
    updated_at: null,
  };

  const prisma = {
    dependencias: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const audit = { record: jest.fn(() => Promise.resolve()) };

  /** Llamadas al mock de auditoría, tipadas como la entrada real. */
  const entradasDeAuditoria = (): AuditEntry[] =>
    (audit.record.mock.calls as unknown as Array<[AuditEntry]>).map(
      ([entrada]) => entrada,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.dependencias.findMany.mockResolvedValue([fila]);

    const module = await Test.createTestingModule({
      providers: [
        DependenciasService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(DependenciasService);
  });

  describe('esElegibleParaOpinion', () => {
    it('admite solo unidades orgánicas', () => {
      expect(esElegibleParaOpinion('UNIDAD_ORGANICA')).toBe(true);
      expect(esElegibleParaOpinion('RECTORADO')).toBe(false);
      expect(esElegibleParaOpinion('OCRI')).toBe(false);
    });
  });

  describe('findAll', () => {
    it('rechaza un kind fuera del enum con 400 (antes estallaba en 500)', async () => {
      await expect(service.findAll({ kind: 'NO_EXISTE' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dependencias.findMany).not.toHaveBeenCalled();
    });

    it('rechaza un is_active que no sea true/false', async () => {
      await expect(service.findAll({ is_active: 'si' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.dependencias.findMany).not.toHaveBeenCalled();
    });

    it('aplica los filtros válidos', async () => {
      await service.findAll({ kind: 'OCRI', is_active: 'true' });
      expect(prisma.dependencias.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { kind: 'OCRI', is_active: true },
        }),
      );
    });
  });

  describe('create', () => {
    const dto: CreateDependenciaDto = {
      code: 'NUEVA',
      name: 'Unidad Nueva',
      kind: 'UNIDAD_ORGANICA',
      is_default_opinion: true,
    };

    it('permite marcar opinión por defecto en unidades orgánicas', async () => {
      prisma.dependencias.findFirst.mockResolvedValue(null);
      prisma.dependencias.create.mockResolvedValue({ ...fila, id: 90n });

      await service.create(dto, { id: 1, email: 'a@a.pe', role: 'admin' });

      expect(prisma.dependencias.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'dependencias', action: 'CREATE' }),
      );
    });

    it('rechaza opinión por defecto en Rectorado/OCRI', async () => {
      await expect(
        service.create({ ...dto, kind: 'RECTORADO' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dependencias.create).not.toHaveBeenCalled();
    });

    it('devuelve 409 si el código ya existe', async () => {
      prisma.dependencias.findFirst.mockResolvedValue({
        ...fila,
        code: 'NUEVA',
      });
      await expect(service.create(dto)).rejects.toThrow('Ya existe');
    });
  });

  describe('update', () => {
    it('rechaza is_default_opinion=true sobre Rectorado', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({
        ...fila,
        code: 'RECTORADO',
        kind: 'RECTORADO',
      });

      await expect(
        service.update(10, { is_default_opinion: true }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dependencias.update).not.toHaveBeenCalled();
    });

    it('normaliza a false una fila heredada no elegible al tocar kind', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({
        ...fila,
        kind: 'UNIDAD_ORGANICA',
        is_default_opinion: true,
      });
      prisma.dependencias.update.mockResolvedValue({
        ...fila,
        kind: 'RECTORADO',
        is_default_opinion: false,
      });

      await service.update(
        10,
        { kind: 'RECTORADO' },
        { id: 1, email: 'a@a.pe', role: 'admin' },
      );

      const updates = prisma.dependencias.update.mock.calls as Array<
        [{ data: { is_default_opinion?: boolean } }]
      >;
      const dataUpdate: { is_default_opinion?: boolean } | undefined =
        updates[0]?.[0].data;
      expect(dataUpdate?.is_default_opinion).toBe(false);

      const actualizacion = entradasDeAuditoria().find(
        (entrada) => entrada.action === 'UPDATE',
      );
      expect(actualizacion?.action).toBe('UPDATE');
      expect(actualizacion?.changes).toMatchObject({
        is_default_opinion: { before: true, after: false },
      });
    });

    it('no escribe auditoría ni actualiza si nada cambió', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({ ...fila });

      await service.update(10, {});

      expect(prisma.dependencias.update).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('impide borrar una dependencia con opiniones asociadas', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({
        ...fila,
        _count: { opinion_requests: 3 },
      });

      await expect(
        service.remove(11, { id: 1, email: 'a@a.pe', role: 'admin' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.dependencias.delete).not.toHaveBeenCalled();
    });

    it('audita la baja cuando no hay opiniones', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({
        ...fila,
        _count: { opinion_requests: 0 },
      });
      prisma.dependencias.delete.mockResolvedValue(fila);

      await service.remove(11, { id: 1, email: 'a@a.pe', role: 'admin' });

      expect(prisma.dependencias.delete).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE' }),
      );
    });
  });

  describe('seed', () => {
    it('no duplica cuando el código no existe pero el nombre sí', async () => {
      // Fila heredada con otro código: el nombre coincide con el canónico
      // (antes el seed creaba una segunda fila para la misma unidad).
      prisma.dependencias.findMany.mockResolvedValue([
        {
          ...fila,
          code: 'ASELEG',
          name: 'Asesoría Legal',
          is_default_opinion: true,
        },
      ]);

      await service.seed({ id: 1, email: 'a@a.pe', role: 'admin' });

      const creados = prisma.dependencias.create.mock.calls as Array<
        [{ data: { name: string } }]
      >;
      const nombresCreados = creados.map(([args]) => args.data.name);
      expect(nombresCreados).not.toContain('Asesoría Legal');
    });

    it('crea las unidades que faltan y audita el resumen', async () => {
      prisma.dependencias.findMany.mockResolvedValue([]);
      prisma.dependencias.create.mockImplementation(
        (args: { data: { code: string } }) =>
          Promise.resolve({ ...fila, code: args.data.code, id: 70n }),
      );

      const result = await service.seed({
        id: 1,
        email: 'a@a.pe',
        role: 'admin',
      });

      expect(prisma.dependencias.create).toHaveBeenCalledTimes(66);
      expect(result.message).toContain('66 creadas');

      const entradas = entradasDeAuditoria();
      const resumen = entradas.find(
        (entrada) => entrada.action === 'SEED' && entrada.entityId == null,
      );
      expect(resumen?.description).toBe(
        'Seed de catálogo: 66 creadas, 0 actualizadas',
      );
    });
  });
});
