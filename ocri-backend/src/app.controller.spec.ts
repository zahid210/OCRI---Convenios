import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  const mockAppService = {
    getHealth: jest.fn().mockResolvedValue({
      status: 'ok',
      database: 'connected',
      totalUsers: 1,
      sampleUser: {
        id: 1,
        name: 'Administrador',
        email: 'admin@uncp.edu.pe',
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return the health status', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
        totalUsers: 1,
        sampleUser: {
          id: 1,
          name: 'Administrador',
          email: 'admin@uncp.edu.pe',
        },
      });
    });
  });
});
