import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';
import { SeedUsersService } from './seed-users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SeedUsersService', () => {
  let service: SeedUsersService;
  const upsert = jest.fn();

  const seedKeys = [
    'SEED_ADMIN_PASSWORD',
    'SEED_ADMIN_EMAIL',
    'SEED_DEMO_PASSWORD',
    'SEED_DEMO_EMAIL_1',
    'SEED_DEMO_EMAIL_2',
    'SEED_DEMO_NAME_1',
    'SEED_DEMO_NAME_2',
  ];

  const original: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of seedKeys) {
      original[key] = process.env[key];
    }
  });

  afterAll(() => {
    for (const key of seedKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  beforeEach(async () => {
    for (const key of seedKeys) delete process.env[key];
    upsert.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        SeedUsersService,
        { provide: PrismaService, useValue: { users: { upsert } } },
      ],
    }).compile();
    service = module.get(SeedUsersService);
  });

  it('no toca la base si faltan las variables de seed', async () => {
    await service.onModuleInit();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('aplica la contraseña de seed (encriptada) al admin y a los dos demos', async () => {
    process.env.SEED_ADMIN_PASSWORD = 'admin-pass';
    process.env.SEED_DEMO_PASSWORD = 'demo-pass';
    await service.onModuleInit();

    expect(upsert).toHaveBeenCalledTimes(3);

    const calls = upsert.mock.calls as Array<
      Array<{
        where: { email: string };
        update: { password: string };
        create?: { name: string; role: string };
      }>
    >;
    const byEmail = new Map(calls.map(([args]) => [args.where.email, args]));

    expect(byEmail.get('ocri@uncp.edu.pe')).toBeDefined();
    expect(byEmail.get('jesus@uncp.edu.pe')).toBeDefined();
    expect(byEmail.get('berna@uncp.edu.pe')).toBeDefined();

    // La contraseña se persiste encriptada, nunca en claro.
    const admin = byEmail.get('ocri@uncp.edu.pe')!;
    expect(admin.update.password).not.toBe('admin-pass');
    await expect(
      bcrypt.compare('admin-pass', admin.update.password),
    ).resolves.toBe(true);

    const jesus = byEmail.get('jesus@uncp.edu.pe')!;
    await expect(
      bcrypt.compare('demo-pass', jesus.update.password),
    ).resolves.toBe(true);

    const berna = byEmail.get('berna@uncp.edu.pe')!;
    await expect(
      bcrypt.compare('demo-pass', berna.update.password),
    ).resolves.toBe(true);
  });

  it('usa los nombres/emails por defecto y roles correctos', async () => {
    process.env.SEED_ADMIN_PASSWORD = 'p1';
    process.env.SEED_DEMO_PASSWORD = 'p2';
    await service.onModuleInit();

    const calls = upsert.mock.calls as Array<
      Array<{
        where: { email: string };
        update: unknown;
        create?: { name: string; role: string };
      }>
    >;
    const createByEmail = new Map(
      calls
        .filter(([args]) => args.create)
        .map(([args]) => [args.where.email, args.create!]),
    );

    const admin = createByEmail.get('ocri@uncp.edu.pe')!;
    expect(admin).toMatchObject({ name: 'Administrador OCRI', role: 'admin' });
    expect(createByEmail.get('jesus@uncp.edu.pe')).toMatchObject({
      role: 'asistente',
    });
    expect(createByEmail.get('berna@uncp.edu.pe')!).toMatchObject({
      role: 'procesador',
    });
  });

  it('respeta sobrescrituras por entorno (emails y nombres)', async () => {
    process.env.SEED_ADMIN_PASSWORD = 'p1';
    process.env.SEED_DEMO_PASSWORD = 'p2';
    process.env.SEED_ADMIN_EMAIL = 'admin@x.pe';
    process.env.SEED_DEMO_EMAIL_2 = 'otra@x.pe';
    process.env.SEED_DEMO_NAME_2 = 'OtroNombre';
    await service.onModuleInit();

    const calls = upsert.mock.calls as Array<
      Array<{
        where: { email: string };
        update: unknown;
        create?: { name: string };
      }>
    >;
    const createByEmail = new Map(
      calls
        .filter(([args]) => args.create)
        .map(([args]) => [args.where.email, args.create!]),
    );

    expect(createByEmail.get('admin@x.pe')).toMatchObject({
      name: 'Administrador OCRI',
    });
    expect(createByEmail.get('otra@x.pe')).toMatchObject({
      name: 'OtroNombre',
    });
  });

  it('si la contraseña de seed está vacía no persiste nada', async () => {
    process.env.SEED_ADMIN_PASSWORD = '';
    await service.onModuleInit();
    expect(upsert).not.toHaveBeenCalled();
  });
});
