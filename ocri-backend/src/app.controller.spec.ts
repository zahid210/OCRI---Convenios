import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StorageService } from './common/storage/storage.service';

describe('AppController', () => {
  let appController: AppController;

  const mockAppService = {
    getHealth: jest.fn().mockReturnValue({ status: 'ok' }),
  };

  const mockStorageService = {
    healthCheck: jest.fn().mockResolvedValue({
      configured: true,
      ok: true,
      message: 'S3 conectado',
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
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  describe('getHealth', () => {
    it('should return the health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
      });
    });
  });

  describe('getStorageHealth', () => {
    it('delegates to StorageService.healthCheck', async () => {
      await expect(appController.getStorageHealth()).resolves.toEqual({
        configured: true,
        ok: true,
        message: 'S3 conectado',
      });
      expect(mockStorageService.healthCheck).toHaveBeenCalled();
    });
  });
});
