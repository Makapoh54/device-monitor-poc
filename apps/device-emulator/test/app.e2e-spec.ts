import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DeviceState } from '@app/device-client';
import { ChecksumService } from '@app/common';

describe('Device Emulator (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ChecksumService)
      .useValue({
        checksum: jest.fn(async () => 'e2e-checksum'),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/device/status (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/device/status')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        mac: expect.any(String),
        name: expect.any(String),
        state: DeviceState.ONLINE,
        checksum: 'e2e-checksum',
      }),
    );
  });
});
