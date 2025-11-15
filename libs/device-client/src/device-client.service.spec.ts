import { Test, TestingModule } from '@nestjs/testing';
import {
  DEVICE_CLIENT_TRANSPORT,
  DeviceClientService,
} from './device-client.service';
import { DeviceClientTransport } from './transport';

describe('DeviceClientService', () => {
  let service: DeviceClientService;

  beforeEach(async () => {
    const transportMock: DeviceClientTransport = {
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceClientService,
        {
          provide: DEVICE_CLIENT_TRANSPORT,
          useValue: transportMock,
        },
      ],
    }).compile();

    service = module.get<DeviceClientService>(DeviceClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
