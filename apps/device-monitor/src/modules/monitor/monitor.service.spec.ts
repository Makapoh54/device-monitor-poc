/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger } from '@app/common';
import { DeviceStatus, DeviceState } from '@app/device-client';
import { MonitorService } from './monitor.service';
import { DeviceStatusSyncService } from './device-status-sync.service';
import { DeviceEntity } from './entities/device.entity';
import { DiscoveryService } from '../discovery/discovery.service';
import { DiscoveredDevice } from '../discovery/discovery.types';

describe('MonitorService', () => {
  let service: MonitorService;
  let discoveryService: jest.Mocked<DiscoveryService>;
  let repository: jest.Mocked<Repository<DeviceEntity>>;
  let syncService: jest.Mocked<DeviceStatusSyncService>;

  const loggerMock: Partial<AppLogger> = {
    setContext: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn(),
  };

  const discovered: DiscoveredDevice = {
    id: 'id-1',
    name: 'dev-1',
    host: 'device-1',
    httpUrl: 'http://device-1:3000',
  };

  const deviceEntity = (): DeviceEntity =>
    ({
      id: '1',
      mac: 'AA',
      name: 'dev-1',
      model: 'm1',
      shortname: 's1',
      ip: '127.0.0.1',
      productLine: 'network',
      state: DeviceState.ONLINE,
      version: '1.0.0',
      firmwareStatus: 'upToDate',
      isConsole: true,
      isManaged: true,
      startupTime: new Date(),
      adoptionTime: null,
      checksum: 'checksum',
      host: 'device-1',
      lastSeenAt: new Date(),
    }) as DeviceEntity;

  beforeEach(async () => {
    discoveryService = {
      discoverDevices: jest.fn(),
    } as unknown as jest.Mocked<DiscoveryService>;

    repository = {
      find: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<DeviceEntity>>;

    syncService = {
      fetchStatus: jest.fn(),
      validateAndUpsertStatus: jest.fn(),
    } as unknown as jest.Mocked<DeviceStatusSyncService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitorService,
        { provide: AppLogger, useValue: loggerMock },
        { provide: DiscoveryService, useValue: discoveryService },
        {
          provide: getRepositoryToken(DeviceEntity),
          useValue: repository,
        },
        {
          provide: DeviceStatusSyncService,
          useValue: syncService,
        },
      ],
    }).compile();

    service = module.get(MonitorService);
  });

  it('getDevices returns devices ordered by name via repository', async () => {
    const devices = [deviceEntity()];
    repository.find.mockResolvedValue(devices);

    const result = await service.getDevices();

    expect(repository.find).toHaveBeenCalledWith({
      order: { name: 'ASC' },
    });
    expect(result).toEqual(devices);
  });

  it('runDiscovery updates snapshot and syncs devices', async () => {
    discoveryService.discoverDevices.mockResolvedValue([discovered]);
    repository.find.mockResolvedValue([]);

    await service.runDiscovery();

    expect(discoveryService.discoverDevices).toHaveBeenCalled();
    expect(syncService.fetchStatus).toHaveBeenCalledWith(discovered);
    expect(syncService.validateAndUpsertStatus).toHaveBeenCalled();
  });

  it('pollDevices skips when discovery has not run', async () => {
    const result = await service.pollDevices();

    expect(result).toBeUndefined();
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('pollDevices handles undiscovered devices', async () => {
    (service as any).hasDiscoveryRun = true;
    repository.find.mockResolvedValue([deviceEntity()]);

    await service.pollDevices();

    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('pollDevices handles successful polling via sync service', async () => {
    (service as any).hasDiscoveryRun = true;
    const dbDev = deviceEntity();
    repository.find.mockResolvedValue([dbDev]);
    (service as any).latestDiscoveredDevicesByHost = new Map([
      [dbDev.host, discovered],
    ]);

    const status: DeviceStatus = {
      mac: dbDev.mac,
      name: dbDev.name,
      model: dbDev.model,
      shortname: dbDev.shortname,
      ip: dbDev.ip,
      productLine: dbDev.productLine,
      state: DeviceState.ONLINE,
      version: dbDev.version,
      firmwareStatus: dbDev.firmwareStatus,
      isConsole: dbDev.isConsole,
      isManaged: dbDev.isManaged,
      startupTime: dbDev.startupTime.toISOString(),
      adoptionTime: dbDev.adoptionTime?.toISOString() ?? '',
      checksum: dbDev.checksum,
    };

    syncService.fetchStatus.mockResolvedValue(status);

    await service.pollDevices();

    expect(syncService.fetchStatus).toHaveBeenCalledWith(discovered);
    expect(syncService.validateAndUpsertStatus).toHaveBeenCalledWith(
      status,
      discovered,
      DeviceState.ONLINE,
    );
  });
});
