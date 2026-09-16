import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';

interface LoginBody {
  access_token: string;
  user: { id: number; name: string; email: string; role: string };
}

interface SeguimientoBody {
  meta: { total: number };
  data: unknown[];
}

// Requiere credenciales de seed disponibles en el entorno (SEED_ADMIN_PASSWORD);
// sin ellas los usuarios por defecto no se sincronizan y el login no es determinista.
const authSuite = process.env.SEED_ADMIN_PASSWORD ? describe : describe.skip;
authSuite('Auth (e2e)', () => {
  let app: INestApplication;

  const email = process.env.SEED_ADMIN_EMAIL || 'ocri@uncp.edu.pe';
  const password = process.env.SEED_ADMIN_PASSWORD || '';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Reproduce la configuración de bootstrap(): /api + mismo pipeline que producción.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('inicia sesión con las credenciales de seed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const body = res.body as LoginBody;
    expect(body).toHaveProperty('access_token');
    expect(body.user.email).toBe(email);
  });

  it('rechaza credenciales inválidas con 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'clave-equivocada-xyz' })
      .expect(401);
  });

  it('accede a /api/seguimiento con el token y lo bloquea sin él', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const token = (login.body as LoginBody).access_token;

    await request(app.getHttpServer())
      .get('/api/seguimiento?page=1&per_page=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        const seguimiento = res.body as SeguimientoBody;
        expect(seguimiento).toHaveProperty('meta');
        expect(seguimiento.meta).toHaveProperty('total');
        expect(seguimiento).toHaveProperty('data');
      });

    await request(app.getHttpServer())
      .get('/api/seguimiento?page=1&per_page=5')
      .expect(401);
  });
});
