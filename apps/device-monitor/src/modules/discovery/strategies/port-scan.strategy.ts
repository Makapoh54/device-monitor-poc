import { Injectable } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { AppLogger } from '@app/common';
import { DiscoveredDevice, DiscoveryStrategy } from '../discovery.types';

@Injectable()
export class PortScanDiscoveryStrategy implements DiscoveryStrategy {
  public readonly name = 'PortScanDiscovery';
  private readonly host = '127.0.0.1';
  private readonly startPort = 3001;
  private readonly endPort = 3020;
  private readonly timeoutMs = 1000;

  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(PortScanDiscoveryStrategy.name);
  }

  async discover(): Promise<DiscoveredDevice[]> {
    const ports = Array.from(
      { length: this.endPort - this.startPort + 1 },
      (_, index) => this.startPort + index,
    );

    const checks = ports.map((port) => this.checkPort(port));
    const results = await Promise.all(checks);

    const devices: DiscoveredDevice[] = results.filter(
      (result): result is DiscoveredDevice => result !== null,
    );

    this.logger.debug(
      `Port-scan discovery found ${devices.length} device(s) on ${this.host}:${this.startPort}-${this.endPort}`,
    );

    return devices;
  }

  private async checkPort(port: number): Promise<DiscoveredDevice | null> {
    const isOpen = await this.isPortOpen(port);
    if (!isOpen) {
      return null;
    }

    const id = `${this.host}:${port}`;
    const name = id;
    const httpUrl = `http://${id}`;

    return {
      id,
      name,
      host: id,
      httpUrl,
    };
  }

  private async isPortOpen(port: number): Promise<boolean> {
    const url = `http://${this.host}:${port}/v1/device/status`;

    try {
      const response = await Promise.race([
        fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }),
        sleep(this.timeoutMs, null),
      ]);

      if (!response) {
        return false;
      }

      return response.ok;
    } catch {
      return false;
    }
  }
}
