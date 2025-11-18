import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from '@app/common';
import { PortScanDiscoveryStrategy } from './port-scan.strategy';

describe('PortScanDiscoveryStrategy', () => {
  let strategy: PortScanDiscoveryStrategy;

  const loggerMock: Partial<AppLogger> = {
    setContext: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortScanDiscoveryStrategy,
        { provide: AppLogger, useValue: loggerMock },
      ],
    }).compile();

    strategy = module.get(PortScanDiscoveryStrategy);
  });

  it('returns empty list when no ports respond', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const devices = await strategy.discover();

    expect(devices).toEqual([]);

    global.fetch = originalFetch!;
  });

  it('discovers device when fetch succeeds', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

    const devices = await strategy.discover();

    expect(devices.length).toBeGreaterThanOrEqual(1);

    global.fetch = originalFetch!;
  });
});
