// noinspection DuplicatedCode
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const instance = mod.createNestApplication<INestApplication<App>>();
    instance.setGlobalPrefix('api');
    instance.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        forbidNonWhitelisted: true,
        whitelist: true,
      }),
    );
    await instance.init();
    app = instance;
  });

  it('/api/health (GET) should return ok status', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        // El healthcheck es deliberadamente mínimo: no debe revelar el estado
        // de la infraestructura (BD/storage) a un visitante anónimo.
        expect(res.body).not.toHaveProperty('database');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
