/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger, ChecksumService } from '@app/common';
import { DeviceClientPoolService, DeviceState } from '@app/device-client';
import { DeviceStatusSyncService } from './device-status-sync.service';
import { DeviceEntity } from './entities/device.entity';
import { DiscoveredDevice } from '../discovery/discovery.types';

describe('DeviceStatusSyncService', () => {
  let service: DeviceStatusSyncService;
  let clientPool: jest.Mocked<DeviceClientPoolService>;
  let checksumService: jest.Mocked<ChecksumService>;
  let repository: jest.Mocked<Repository<DeviceEntity>>;

  const discovered: DiscoveredDevice = {
    id: 'id-1',
    name: 'dev-1',
    host: 'device-1',
    httpUrl: 'http://device-1:3000',
  };

  const baseStatus = {
    mac: 'AA:BB:CC:DD:EE:FF',
    name: 'Device 1',
    model: 'Model',
    shortname: 'DEV1',
    ip: '192.168.0.10',
    productLine: 'network',
    state: DeviceState.ONLINE,
    version: '1.0.0',
    firmwareStatus: 'upToDate',
    isConsole: true,
    isManaged: true,
    startupTime: '2025-01-01T00:00:00.000Z',
    adoptionTime: '2025-01-02T00:00:00.000Z',
    checksum: 'checksum-1',
  };

  beforeEach(async () => {
    const loggerMock: Partial<AppLogger> = {
      setContext: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      verbose: jest.fn(),
    };

    clientPool = {
      getStatusForEndpoint: jest.fn(),
    } as unknown as jest.Mocked<DeviceClientPoolService>;

    checksumService = {
      checksum: jest.fn(),
      verifyChecksum: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<ChecksumService>;

    repository = {
      upsert: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Repository<DeviceEntity>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceStatusSyncService,
        { provide: AppLogger, useValue: loggerMock },
        { provide: DeviceClientPoolService, useValue: clientPool },
        { provide: ChecksumService, useValue: checksumService },
        {
          provide: getRepositoryToken(DeviceEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(DeviceStatusSyncService);
  });

  it('fetchStatus delegates to DeviceClientPoolService', async () => {
    clientPool.getStatusForEndpoint.mockResolvedValue(baseStatus as any);

    const result = await service.fetchStatus(discovered);

    expect(clientPool.getStatusForEndpoint).toHaveBeenCalledWith({
      host: discovered.host,
    });
    expect(result).toEqual(baseStatus);
  });

  it('validateAndUpsertStatus verifies checksum and upserts when checksum differs', async () => {
    await service.validateAndUpsertStatus(baseStatus, discovered);

    const { checksum, ...payload } = baseStatus;

    expect(checksumService.verifyChecksum).toHaveBeenCalledWith(
      payload,
      checksum,
    );
    expect(repository.upsert).toHaveBeenCalledTimes(1);
  });

  it('validateAndUpsertStatus logs error when checksum is invalid but still upserts', async () => {
    checksumService.verifyChecksum.mockResolvedValueOnce(false);

    await service.validateAndUpsertStatus(baseStatus, discovered);

    expect(repository.upsert).toHaveBeenCalledTimes(1);
  });

  it('upsert is skipped when composite checksum has not changed', async () => {
    await service.validateAndUpsertStatus(baseStatus, discovered);
    await service.validateAndUpsertStatus(baseStatus, discovered);

    expect(repository.upsert).toHaveBeenCalledTimes(1);
  });

  it('upsert includes derived fields and overrideState', async () => {
    const status = { ...baseStatus, state: DeviceState.DEGRADED };

    await service.validateAndUpsertStatus(
      status,
      discovered,
      DeviceState.ONLINE,
    );

    expect(repository.upsert).toHaveBeenCalledTimes(1);
    const [entity] = (repository.upsert as jest.Mock).mock.calls[0];

    expect(entity.mac).toBe(status.mac);
    expect(entity.state).toBe(DeviceState.ONLINE);
    expect(entity.host).toBe(discovered.host);
    expect(entity.startupTime).toBeInstanceOf(Date);
    expect(entity.adoptionTime).toBeInstanceOf(Date);
  });
});
