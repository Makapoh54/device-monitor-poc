import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@app/common';
import { DiscoveredDevice, DiscoveryStrategy } from './discovery.types';
import { DockerSocketDiscoveryStrategy } from './strategies/docker-socket.strategy';
import { PortScanDiscoveryStrategy } from './strategies/port-scan.strategy';
import { DISCOVERY_DEVICE_LIST, DISCOVERY_STRATEGIES } from '../../config';

@Injectable()
export class DiscoveryService implements OnModuleInit {
  private readonly strategies: DiscoveryStrategy[] = [];
  private readonly overrideDevices: DiscoveredDevice[] = [];

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
    private readonly dockerSocketStrategy: DockerSocketDiscoveryStrategy,
    private readonly portScanStrategy: PortScanDiscoveryStrategy,
  ) {
    this.logger.setContext(DiscoveryService.name);
  }

  onModuleInit(): void {
    const overrideList =
      this.configService.get<string>(DISCOVERY_DEVICE_LIST, '') ?? '';

    if (overrideList.trim().length > 0) {
      const entries = overrideList
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      const devices: DiscoveredDevice[] = entries.map((entry) => {
        const host = entry;
        const httpUrl = `http://${host}`;

        return {
          id: host,
          name: host,
          host,
          httpUrl,
        };
      });

      this.logger.log(
        `DISCOVERY_DEVICE_LIST override provided ${devices.length} device(s); discovery strategies will be skipped`,
      );

      this.overrideDevices.push(...devices);
    } else {
      const strategiesEnv = this.configService.get<string>(
        DISCOVERY_STRATEGIES,
        '',
      );

      const strategyNames = strategiesEnv
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (strategyNames.includes(this.dockerSocketStrategy.name)) {
        this.strategies.push(this.dockerSocketStrategy);
      }

      if (strategyNames.includes(this.portScanStrategy.name)) {
        this.strategies.push(this.portScanStrategy);
      }

      if (this.strategies.length === 0) {
        this.logger.warn(
          `No valid discovery strategies enabled via DISCOVERY_STRATEGIES="${strategiesEnv}", falling back to "DockerSocketDiscovery"`,
        );
        this.strategies.push(this.dockerSocketStrategy);
      }
    }
  }

  async discoverDevices(): Promise<DiscoveredDevice[]> {
    if (this.overrideDevices.length > 0) {
      return this.overrideDevices;
    }

    const results: DiscoveredDevice[][] = [];

    for (const strategy of this.strategies) {
      try {
        const devices = await strategy.discover();
        results.push(devices);
        this.logger.log(`Discovered ${devices.length} via ${strategy.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.error(
          `Discovery strategy ${strategy.constructor.name} failed: ${message}`,
        );
      }
    }

    const uniqueByHttpUrl = new Map<string, DiscoveredDevice>();
    const merged = results.flat();

    for (const device of merged) {
      uniqueByHttpUrl.set(device.httpUrl, device);
    }

    return Array.from(uniqueByHttpUrl.values());
  }
}
