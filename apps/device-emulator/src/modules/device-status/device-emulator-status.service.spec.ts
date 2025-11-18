import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeviceEmulatorStatusService } from './device-emulator-status.service';
import { DEVICE_META, DeviceBehaviour, DeviceMeta } from '../../config/consts';
import {
  NetworkInfo,
  NetworkInfoService,
} from '../network-info/network-info.service';
import { AppLogger, ChecksumService } from '@app/common';
import { DeviceState } from '@app/device-client';

describe('DeviceEmulatorStatusService', () => {
  const createDeviceMeta = (behaviour: DeviceBehaviour): DeviceMeta => ({
    version: '1.0.0',
    firmwareStatus: 'upToDate',
    productLine: 'network',
    shortname: 'UDMPROSE',
    model: 'UDM SE',
    name: 'unifi.yourdomain.com',
    isManaged: true,
    adoptionTime: '2024-06-19T13:41:43Z',
    behaviour,
  });

  const createTestingModule = async (behaviour: DeviceBehaviour) => {
    const deviceMeta = createDeviceMeta(behaviour);

    const networkInfo: NetworkInfo = {
      id: 'test',
      name: 'test',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      ipv4Address: '192.168.0.10',
      ipv6Address: null,
      networks: [],
    };

    const loggerMock: AppLogger = {
      setContext: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as unknown as AppLogger;

    const networkInfoServiceMock: Partial<NetworkInfoService> = {
      getContainerNetworkInfo: jest.fn().mockReturnValue(networkInfo),
    };

    const configServiceMock: Partial<ConfigService> = {
      get: jest.fn((key: string) =>
        key === DEVICE_META ? deviceMeta : undefined,
      ),
    };

    const checksumServiceMock: Partial<ChecksumService> = {
      checksum: jest.fn(async () => 'mock-checksum'),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceEmulatorStatusService,
        {
          provide: AppLogger,
          useValue: loggerMock,
        },
        {
          provide: NetworkInfoService,
          useValue: networkInfoServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: ChecksumService,
          useValue: checksumServiceMock,
        },
      ],
    }).compile();

    const service = moduleRef.get(DeviceEmulatorStatusService);

    return {
      service,
      loggerMock,
      checksumServiceMock,
      networkInfo,
      deviceMeta,
    };
  };

  it('returns ONLINE state for stable behaviour', async () => {
    const { service, checksumServiceMock, deviceMeta, networkInfo } =
      await createTestingModule(DeviceBehaviour.STABLE);

    service.onModuleInit();
    service.onApplicationBootstrap();

    const status = await service.getStatus();

    expect(status.state).toBe(DeviceState.ONLINE);
    expect(status.name).toBe(deviceMeta.name);
    expect(status.ip).toBe(networkInfo.ipv4Address);
    expect(checksumServiceMock.checksum as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        mac: networkInfo.macAddress,
        name: deviceMeta.name,
        model: deviceMeta.model,
        shortname: deviceMeta.shortname,
        ip: networkInfo.ipv4Address,
        productLine: deviceMeta.productLine,
      }),
    );
    expect(status.checksum).toBe('mock-checksum');
  });

  it('does not throw before downAfterMs for DOWN behaviour', async () => {
    const { service } = await createTestingModule(DeviceBehaviour.DOWN);

    service.onModuleInit();
    service.onApplicationBootstrap();

    const now = Date.now();
    (service as any).downAfterMs = 1000;
    (service as any).startDate = new Date(now);

    const status = await service.getStatus();

    expect(status.state).toBe(DeviceState.ONLINE);
  });

  it('throws after downAfterMs for DOWN behaviour', async () => {
    const { service } = await createTestingModule(DeviceBehaviour.DOWN);

    service.onModuleInit();
    service.onApplicationBootstrap();

    const now = Date.now();
    (service as any).downAfterMs = 1000;
    (service as any).startDate = new Date(now - 2000);

    await expect(service.getStatus()).rejects.toThrow('Simulated device down');
  });

  it('throws inside degraded offline window', async () => {
    const { service } = await createTestingModule(DeviceBehaviour.DEGRADED);

    service.onModuleInit();
    service.onApplicationBootstrap();

    const now = Date.now();
    (service as any).degradedOfflineWindowSeconds = 5;
    (service as any).startDate = new Date(now - 12000);

    await expect(service.getStatus()).rejects.toThrow(
      'Simulated intermittent degraded offline window',
    );
  });

  it('does not throw outside degraded offline window and reports DEGRADED state', async () => {
    const { service } = await createTestingModule(DeviceBehaviour.DEGRADED);

    service.onModuleInit();
    service.onApplicationBootstrap();

    const now = Date.now();
    (service as any).degradedOfflineWindowSeconds = 5;
    (service as any).startDate = new Date(now - 2000);

    const status = await service.getStatus();

    expect(status.state).toBe(DeviceState.DEGRADED);
  });
});
