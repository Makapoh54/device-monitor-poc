import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Docker from 'dockerode';
import { AppLogger } from '@app/common';
import { DiscoveredDevice, DiscoveryStrategy } from '../discovery.types';

@Injectable()
export class DockerSocketDiscoveryStrategy implements DiscoveryStrategy {
  public name = 'DockerSocketDiscovery';
  private readonly docker: Docker;
  private readonly labelFilter: string | null;
  private readonly httpPort: number;
  private readonly protocol: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(DockerSocketDiscoveryStrategy.name);

    const socketPath =
      this.configService.get<string >('DOCKER_SOCKET_PATH') ??
      '/var/run/docker.sock';

    this.labelFilter =
      this.configService.get<string>('DISCOVERY_DOCKER_LABEL') ??
      'device-monitor.enabled=true';

    this.httpPort = this.configService.get<number>('DEVICE_HTTP_PORT') ?? 3000;

    this.protocol =
      this.configService.get<string>('DEVICE_HTTP_PROTOCOL') ?? 'http';

    this.docker = new Docker({ socketPath });
  }

  async discover(): Promise<DiscoveredDevice[]> {
    try {
      const filters =
        this.labelFilter != null && this.labelFilter.length > 0
          ? {
              label: [this.labelFilter],
            }
          : undefined;

      const containers = await this.docker.listContainers({
        all: false,
        filters,
      });

      const devices: DiscoveredDevice[] = containers.map((container) => {
        const id = container.Id;
        const name =
          (container.Names && container.Names[0]?.replace(/^\//, '')) || id;

        const serviceName =
          container.Labels?.['com.docker.compose.service'] ?? name;

        const host = serviceName;
        const httpUrl = `${this.protocol}://${host}:${this.httpPort}`;

        return {
          id,
          name,
          host,
          httpUrl,
        };
      });

      this.logger.debug(
        `Discovered ${devices.length} device containers via Docker socket`,
      );

      return devices;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Failed to discover devices via Docker socket: ${message}`,
      );
      return [];
    }
  }
}
