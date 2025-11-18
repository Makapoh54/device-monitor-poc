import { Test, TestingModule } from '@nestjs/testing';
import { DeviceStatusService } from './device-status.controller';
import { DeviceEmulatorStatusService } from './device-emulator-status.service';
import { DeviceState } from '@app/device-client';
import { DeviceStatusDto } from './dto/get-device-status.dto';

describe('DeviceStatusService', () => {
  let controller: DeviceStatusService;
  let emulatorStatusService: DeviceEmulatorStatusService;

  beforeEach(async () => {
    const emulatorStatusServiceMock: Partial<DeviceEmulatorStatusService> = {
      getStatus: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DeviceStatusService],
      providers: [
        {
          provide: DeviceEmulatorStatusService,
          useValue: emulatorStatusServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<DeviceStatusService>(DeviceStatusService);
    emulatorStatusService = moduleRef.get<DeviceEmulatorStatusService>(
      DeviceEmulatorStatusService,
    );
  });

  const createStatus = (): DeviceStatusDto => ({
    mac: 'F4E2C6C23F13',
    name: 'unifi.yourdomain.com',
    model: 'UDM SE',
    shortname: 'UDMPROSE',
    ip: '192.168.1.226',
    productLine: 'network',
    state: DeviceState.ONLINE,
    version: '4.1.13',
    firmwareStatus: 'upToDate',
    isConsole: true,
    isManaged: true,
    startupTime: '2024-06-19T13:41:43Z',
    adoptionTime: '2024-06-19T13:41:43Z',
    checksum: 'checksum',
  });

  it('getStatus (Rest) delegates to DeviceEmulatorStatusService', async () => {
    const status = createStatus();
    (emulatorStatusService.getStatus as jest.Mock).mockResolvedValue(status);

    const result = await controller.getStatusRest();

    expect(emulatorStatusService.getStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual(status);
  });

  it('getStatus (gRPC) delegates to DeviceEmulatorStatusService', async () => {
    const status = createStatus();
    (emulatorStatusService.getStatus as jest.Mock).mockResolvedValue(status);

    const result = await controller.getStatus();

    expect(emulatorStatusService.getStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual(status);
  });
});
