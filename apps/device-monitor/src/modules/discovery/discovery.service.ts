import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@app/common';
import { DiscoveredDevice, DiscoveryStrategy } from './discovery.types';
import { DockerSocketDiscoveryStrategy } from './strategies/docker-socket.strategy';
import { DISCOVERY_STRATEGIES } from '../../config';

@Injectable()
export class DiscoveryService {
  private readonly strategies: DiscoveryStrategy[];

  constructor(
    private readonly logger: AppLogger,
    private readonly configService: ConfigService,
    private readonly dockerSocketStrategy: DockerSocketDiscoveryStrategy,
  ) {
    this.logger.setContext(DiscoveryService.name);

    const strategiesEnv = this.configService.get<string>(
      DISCOVERY_STRATEGIES,
      '',
    );

    const strategyNames = strategiesEnv
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const strategies: DiscoveryStrategy[] = [];

    if (strategyNames.includes(dockerSocketStrategy.name)) {
      strategies.push(this.dockerSocketStrategy);
    }

    if (strategies.length === 0) {
      this.logger.warn(
        `No valid discovery strategies enabled via DISCOVERY_STRATEGIES="${strategiesEnv}", falling back to "DockerSocketDiscovery"`,
      );
      strategies.push(this.dockerSocketStrategy);
    }

    this.strategies = strategies;
  }

  async discoverDevices(): Promise<DiscoveredDevice[]> {
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

    const merged = results.flat();

    const uniqueByHttpUrl = new Map<string, DiscoveredDevice>();
    for (const device of merged) {
      uniqueByHttpUrl.set(device.httpUrl, device);
    }

    return Array.from(uniqueByHttpUrl.values());
  }
}
