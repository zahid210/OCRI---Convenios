import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { user_role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BCRYPT_ROUNDS } from '../auth/auth.constants';
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
      where: { email },
    });
  }

  async findById(id: number) {
    return this.prisma.users.findUnique({
      where: { id: BigInt(id) },
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
      data: this.serializeBigInt(data),
      meta: {
        total,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage),
      },
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.users.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.users.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role as user_role,
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

    return this.serializeBigInt(user);
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.prisma.users.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.users.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Ya existe un usuario con ese correo.');
      }
    }

    if (dto.role && dto.role !== user.role) {
      const isLastAdmin =
        user.role === 'admin' && (await this.countAdmins()) <= 1;
      if (isLastAdmin) {
        throw new BadRequestException(
          'No se puede cambiar el rol del último administrador del sistema.',
        );
      }
    }

    const data: {
      name?: string;
      email?: string;
      role?: user_role;
      password?: string;
      updated_at?: Date;
    } = { updated_at: new Date() };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role as user_role;
    if (dto.password)
      data.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const updated = await this.prisma.users.update({
      where: { id: BigInt(id) },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });

    return this.serializeBigInt(updated);
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

    if (user.role === 'admin' && (await this.countAdmins()) <= 1) {
      throw new BadRequestException(
        'No se puede eliminar el último administrador del sistema.',
      );
    }

    await this.prisma.users.delete({ where: { id: BigInt(id) } });

    return { message: `Usuario "${user.name}" eliminado correctamente.` };
  }

  private async countAdmins(): Promise<number> {
    return this.prisma.users.count({ where: { role: 'admin' } });
  }

  private serializeBigInt<T>(obj: unknown): T {
    const jsonString = JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : (value as unknown),
    );
    return JSON.parse(jsonString) as T;
  }
}
