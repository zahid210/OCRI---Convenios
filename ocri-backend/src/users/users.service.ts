import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, user_role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';
import { serializeBigInt } from '../common/process.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

interface UserFilters {
  search?: string;
  page?: string | number;
  per_page?: string | number;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  async findById(id: number) {
    return this.prisma.users.findUnique({
      where: { id: BigInt(id) },
    });
  }

  /** Normaliza correos (trim + minúsculas) de forma consistente en altas/cambios. */
  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Revoca las sesiones activas de un usuario incrementando su `token_version`.
   * Lo usan el logout (POST /api/auth/logout) para invalidar el token actual.
   */
  async bumpTokenVersion(id: number) {
    await this.prisma.users.update({
      where: { id: BigInt(id) },
      data: { token_version: { increment: 1 } },
    });
  }

  async findAll(filters: UserFilters = {}) {
    const page = Number(filters.page) || 1;
    const perPage = Number(filters.per_page) || 10;
    const skip = (page - 1) * perPage;

    const where = filters.search
      ? {
          OR: [
            { name: { contains: filters.search.trim() } },
            { email: { contains: filters.search.trim() } },
          ],
        }
      : {};

    const [total, data] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { id: 'asc' },
        skip,
        take: perPage,
      }),
    ]);

    return {
      data: serializeBigInt(data),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    };
  }

  async create(dto: CreateUserDto) {
    const email = UsersService.normalizeEmail(dto.email);

    const existing = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.prisma.users.create({
        data: {
          name: dto.name,
          email,
          password: hashedPassword,
          role: dto.role as user_role,
          password_changed_at: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true,
        },
      });

      return serializeBigInt(user);
    } catch (err) {
      // La comprobación previa no basta: dos altas simultáneas del mismo correo
      // pasan el findUnique y solo una gana en la BD. El P2002 se traduce a 409
      // en vez de aflorar como 500.
      if (UsersService.isUniqueViolation(err)) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    if (dto.email) {
      const email = UsersService.normalizeEmail(dto.email);
      if (email !== user.email) {
        const existing = await this.prisma.users.findUnique({
          where: { email },
        });
        if (existing) {
          throw new ConflictException('Ya existe un usuario con ese correo.');
        }
      }
    }

    // Solo hay riesgo de dejar el sistema sin admin cuando se degrada a un
    // admin a otro rol. Se resuelve dentro de una transacción con bloqueo (ver
    // más abajo), para que dos degradaciones simultáneas no pasen ambas.
    const demotingAdmin =
      user.role === 'admin' && dto.role !== undefined && dto.role !== user.role;

    const data: {
      name?: string;
      email?: string;
      role?: user_role;
      password?: string;
      token_version?: { increment: number };
      password_changed_at?: Date;
      updated_at?: Date;
    } = { updated_at: new Date() };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) {
      data.email = UsersService.normalizeEmail(dto.email);
      // Un cambio de correo también exige nueva sesión: rota el token_version.
      if (data.email !== user.email) data.token_version = { increment: 1 };
    }
    if (dto.role !== undefined) data.role = dto.role as user_role;
    if (dto.role !== undefined && dto.role !== user.role) {
      // Un cambio de rol debe reflejarse en las próximas peticiones: invalida
      // las sesiones actuales en lugar de esperar a que expiren (8h).
      data.token_version = { increment: 1 };
    }
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      // Cambio de contraseña: revoca las sesiones vigentes y registra la fecha.
      data.token_version = { increment: 1 };
      data.password_changed_at = new Date();
    }

    const select = {
      id: true,
      name: true,
      email: true,
      role: true,
      created_at: true,
      updated_at: true,
    } as const;

    try {
      const updated = demotingAdmin
        ? await this.prisma.$transaction(async (tx) => {
            // FOR UPDATE serializa a los que intentan quitar admins a la vez:
            // el segundo espera al primero y vuelve a contar con el estado ya
            // consolidado, en lugar de decidir sobre una foto obsoleta.
            const admins = await UsersService.countAdminsLocked(tx);
            if (admins <= 1) {
              throw new BadRequestException(
                'No se puede cambiar el rol del último administrador del sistema.',
              );
            }
            return tx.users.update({
              where: { id: BigInt(id) },
              data,
              select,
            });
          })
        : await this.prisma.users.update({
            where: { id: BigInt(id) },
            data,
            select,
          });

      return serializeBigInt(updated);
    } catch (err) {
      if (UsersService.isUniqueViolation(err)) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }
      throw err;
    }
  }

  async remove(id: number, requestingUserId: number) {
    if (id === requestingUserId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }

    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    if (user.role === 'admin') {
      // Mismo bloqueo que en `update`: evita que dos eliminaciones simultáneas
      // de los dos últimos admins dejen el sistema sin ninguno.
      await this.prisma.$transaction(async (tx) => {
        const admins = await UsersService.countAdminsLocked(tx);
        if (admins <= 1) {
          throw new BadRequestException(
            'No se puede eliminar el último administrador del sistema.',
          );
        }
        await tx.users.delete({ where: { id: BigInt(id) } });
      });
    } else {
      await this.prisma.users.delete({ where: { id: BigInt(id) } });
    }

    return { message: `Usuario "${user.name}" eliminado correctamente.` };
  }

  /**
   * Cuenta administradores tomando bloqueo de fila (`FOR UPDATE`) dentro de una
   * transacción. Prisma no expone locks en findMany, así que se usa SQL crudo;
   * el `SELECT` seguido de la escritura en la misma transacción serializa las
   * operaciones que podrían dejar la tabla sin administradores.
   */
  private static async countAdminsLocked(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM users WHERE role = 'admin' FOR UPDATE`;
    return rows.length;
  }

  /** ¿El error es una violación de unicidad de Prisma (p. ej. email duplicado)? */
  private static isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }
}
