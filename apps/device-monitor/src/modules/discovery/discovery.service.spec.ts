/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@app/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveredDevice, DiscoveryStrategy } from './discovery.types';
import { DockerSocketDiscoveryStrategy } from './strategies/docker-socket.strategy';
import { PortScanDiscoveryStrategy } from './strategies/port-scan.strategy';
import { DISCOVERY_STRATEGIES } from '../../config';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let dockerStrategy: jest.Mocked<DiscoveryStrategy>;
  let portScanStrategy: jest.Mocked<DiscoveryStrategy>;
  let configService: jest.Mocked<ConfigService>;

  const loggerMock: Partial<AppLogger> = {
    setContext: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const createModule = async (strategiesEnv: string) => {
    dockerStrategy = {
      name: 'DockerSocketDiscovery',
      discover: jest.fn().mockResolvedValue([]),
    };

    portScanStrategy = {
      name: 'PortScanDiscovery',
      discover: jest.fn().mockResolvedValue([]),
    };

    configService = {
      get: jest.fn((key: string) =>
        key === DISCOVERY_STRATEGIES ? strategiesEnv : undefined,
      ),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        { provide: AppLogger, useValue: loggerMock },
        { provide: ConfigService, useValue: configService },
        {
          provide: DockerSocketDiscoveryStrategy,
          useValue: dockerStrategy,
        },
        {
          provide: PortScanDiscoveryStrategy,
          useValue: portScanStrategy,
        },
      ],
    }).compile();

    service = module.get(DiscoveryService);
    service.onModuleInit();
  };

  it('uses DockerSocketDiscovery when configured', async () => {
    await createModule('DockerSocketDiscovery');

    dockerStrategy.discover.mockResolvedValue([
      {
        id: '1',
        name: 'docker',
        host: 'docker-host',
        httpUrl: 'http://docker-host:3000',
      },
    ]);

    const devices = await service.discoverDevices();

    expect(dockerStrategy.discover).toHaveBeenCalledTimes(1);
    expect(portScanStrategy.discover).not.toHaveBeenCalled();
    expect(devices).toHaveLength(1);
  });

  it('uses PortScanDiscovery when configured', async () => {
    await createModule('PortScanDiscovery');

    portScanStrategy.discover.mockResolvedValue([
      {
        id: '2',
        name: 'port-scan',
        host: '127.0.0.1:3001',
        httpUrl: 'http://127.0.0.1:3001',
      },
    ]);

    const devices = await service.discoverDevices();

    expect(portScanStrategy.discover).toHaveBeenCalledTimes(1);
    expect(dockerStrategy.discover).not.toHaveBeenCalled();
    expect(devices).toHaveLength(1);
  });

  it('deduplicates devices by httpUrl across strategies', async () => {
    await createModule('DockerSocketDiscovery,PortScanDiscovery');

    const device: DiscoveredDevice = {
      id: '1',
      name: 'dev',
      host: 'host',
      httpUrl: 'http://host:3000',
    };

    dockerStrategy.discover.mockResolvedValue([device]);
    portScanStrategy.discover.mockResolvedValue([device]);

    const devices = await service.discoverDevices();

    expect(dockerStrategy.discover).toHaveBeenCalledTimes(1);
    expect(portScanStrategy.discover).toHaveBeenCalledTimes(1);
    expect(devices).toHaveLength(1);
  });

  it('falls back to DockerSocketDiscovery when no strategies are configured', async () => {
    await createModule('');

    dockerStrategy.discover.mockResolvedValue([]);

    const devices = await service.discoverDevices();

    expect(dockerStrategy.discover).toHaveBeenCalledTimes(1);
    expect(portScanStrategy.discover).not.toHaveBeenCalled();
    expect(devices).toEqual([]);
  });
});
