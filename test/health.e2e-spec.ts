process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'hrms_setting_test';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthService as CoreHealthService } from '@new-hros/libs-core';
import * as request from 'supertest';
import { HealthController } from '../src/modules/health/controllers/health.controller';
import { HealthService } from '../src/modules/health/services/health.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const healthServiceMock = {
      checkAll: jest.fn().mockResolvedValue({
        status: 'up',
        components: {
          postgres: { status: 'up' },
          redis: { status: 'up' },
        },
      }),
      registerIndicator: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: CoreHealthService,
          useValue: healthServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('setting-api');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /setting-api/health should return 200 OK with health status', () => {
    return request(app.getHttpServer())
      .get('/setting-api/health')
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('info');
      });
  });

  it('GET /health without route prefix should return 404 Not Found', () => {
    return request(app.getHttpServer()).get('/health').expect(404);
  });
});
