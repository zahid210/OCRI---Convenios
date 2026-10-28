import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DependenciasService } from './dependencias.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEntry, AuditService } from '../audit/audit.service';
import { CreateDependenciaDto } from './dto/create-dependencia.dto';

describe('DependenciasService', () => {
  let service: DependenciasService;

  const fila = {
    id: 11n,
    code: 'VRI',
    name: 'Vicerrectorado de Investigación',
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
      deleteMany: jest.fn(),
    },
  };

  const audit = { record: jest.fn(() => Promise.resolve()) };

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

  describe('findAll', () => {
    it('ordena por nombre alfabéticamente y aplica búsqueda', async () => {
      await service.findAll({ search: 'VRI' });
      expect(prisma.dependencias.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ name: { contains: 'VRI' } }, { code: { contains: 'VRI' } }],
        },
        orderBy: [{ name: 'asc' }],
      });
    });
  });

  describe('create', () => {
    const dto: CreateDependenciaDto = {
      code: 'NUEVA',
      name: 'Unidad Nueva',
    };

    it('crea la dependencia y registra auditoría', async () => {
      prisma.dependencias.findFirst.mockResolvedValue(null);
      prisma.dependencias.create.mockResolvedValue({ ...fila, id: 90n });

      await service.create(dto, { id: 1, email: 'a@a.pe', role: 'admin' });

      expect(prisma.dependencias.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'dependencias', action: 'CREATE' }),
      );
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
    it('actualiza nombre y código registrando auditoría', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({ ...fila });
      prisma.dependencias.findFirst.mockResolvedValue(null);
      prisma.dependencias.update.mockResolvedValue({
        ...fila,
        name: 'Nuevo Nombre',
      });

      await service.update(
        11,
        { name: 'Nuevo Nombre' },
        { id: 1, email: 'a@a.pe', role: 'admin' },
      );

      expect(prisma.dependencias.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' }),
      );
    });

    it('no escribe auditoría ni actualiza si nada cambió', async () => {
      prisma.dependencias.findUnique.mockResolvedValue({ ...fila });

      await service.update(11, {});

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
    it('crea las 6 unidades canónicas y audita el resumen', async () => {
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

      expect(prisma.dependencias.create).toHaveBeenCalledTimes(6);
      expect(result.message).toContain('6 creadas');

      const entradas = entradasDeAuditoria();
      const resumen = entradas.find(
        (entrada) => entrada.action === 'SEED' && entrada.entityId == null,
      );
      expect(resumen?.description).toBe(
        'Seed de catálogo: 6 creadas, 0 actualizadas',
      );
    });
  });
});
