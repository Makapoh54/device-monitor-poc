/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MonitorController } from './monitor.controller';
import { MonitorService } from './monitor.service';
import { DeviceEntity } from './entities/device.entity';

describe('MonitorController', () => {
  let controller: MonitorController;
  let service: MonitorService;

  beforeEach(async () => {
    const serviceMock: Partial<MonitorService> = {
      getDevices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitorController],
      providers: [
        {
          provide: MonitorService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<MonitorController>(MonitorController);
    service = module.get<MonitorService>(MonitorService);
  });

  it('getDevices delegates to MonitorService', async () => {
    const devices: DeviceEntity[] = [
      {
        id: '1',
        mac: 'AA',
        name: 'dev-1',
        model: 'm1',
        shortname: 's1',
        ip: '127.0.0.1',
        productLine: 'network',
        state: 'online' as any,
        version: '1.0.0',
        firmwareStatus: 'upToDate',
        isConsole: true,
        isManaged: true,
        startupTime: new Date(),
        adoptionTime: null,
        checksum: 'checksum',
        host: 'host',
        lastSeenAt: new Date(),
      } as DeviceEntity,
    ];

    (service.getDevices as jest.Mock).mockResolvedValue(devices);

    const result = await controller.getDevices();

    expect(service.getDevices).toHaveBeenCalledTimes(1);
    expect(result).toEqual(devices);
  });
});
