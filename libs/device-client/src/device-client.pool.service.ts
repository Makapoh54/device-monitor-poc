import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus } from './dto/device-status.dto';
import {
  DeviceClientModuleOptions,
  DeviceClientTransportType,
} from './device-client.service';
import { DeviceClientTransport } from './transport/device-client.transport';
import {
  GrpcDeviceClientTransport,
  RestDeviceClientTransport,
} from './transport';

export type PooledDeviceClientConfig = DeviceClientModuleOptions;

@Injectable()
export class DeviceClientPoolService {
  public readonly clients = new Map<string, DeviceClientTransport>();
  private readonly grpcSupportByHost = new Map<string, boolean>();
  private readonly grpcPort: number;
  private readonly restPort: number;
  private readonly logger = new Logger(DeviceClientPoolService.name);

  constructor(private readonly configService: ConfigService) {
    this.grpcPort =
      (this.configService.get<number>('DEVICE_GRPC_PORT') as number) ?? 50051;
    this.restPort =
      (this.configService.get<number>('DEVICE_HTTP_PORT') as number) ?? 3000;
  }

  getOrCreateClient(config: PooledDeviceClientConfig): DeviceClientTransport {
    const key = this.getKey(config);

    const existing = this.clients.get(key);
    if (existing) {
      return existing;
    }

    const client = this.createClient(config);
    this.clients.set(key, client);
    return client;
  }

  async getStatus(config: PooledDeviceClientConfig): Promise<DeviceStatus> {
    const client = this.getOrCreateClient(config);
    return client.getStatus();
  }

  async getStatusForEndpoint(params: { host: string }): Promise<DeviceStatus> {
    const { host } = params;

    const grpcSupported = this.grpcSupportByHost.get(host);

    if (grpcSupported !== false) {
      try {
        const status = await this.getStatus({
          transport: DeviceClientTransportType.grpc,
          grpc: {
            url: `${host}:${this.grpcPort}`,
          },
        });

        if (grpcSupported == null) {
          this.grpcSupportByHost.set(host, true);
          this.logger.debug(`Detected gRPC support for host "${host}"`);
        }

        this.logger.debug(`Polled device "${host}" via gRPC`);
        return status;
      } catch (error) {
        if (grpcSupported == null) {
          this.grpcSupportByHost.set(host, false);
          this.logger.debug(
            `No gRPC support for host "${host}", falling back to REST`,
          );
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `gRPC polling failed for host "${host}", falling back to REST: ${message}`,
          );
        }
      }
    }

    this.logger.debug(`Polled device "${host}" via REST`);
    return this.getStatus({
      transport: DeviceClientTransportType.rest,
      rest: {
        baseUrl: `http://${host}:${this.restPort}`,
      },
    });
  }

  remove(id: string): void {
    this.clients.delete(id);
  }

  clear(): void {
    this.clients.clear();
  }

  private createClient(
    config: PooledDeviceClientConfig,
  ): DeviceClientTransport {
    switch (config.transport) {
      case DeviceClientTransportType.rest:
        return new RestDeviceClientTransport(config.rest);
      case DeviceClientTransportType.grpc:
        return new GrpcDeviceClientTransport(config.grpc);
      default:
        throw new Error('Unsupported transport');
    }
  }

  private getKey(config: PooledDeviceClientConfig): string {
    switch (config.transport) {
      case DeviceClientTransportType.rest: {
        const baseUrl = config.rest.baseUrl.replace(/\/+$/, '');
        return `rest:${baseUrl}`;
      }
      case DeviceClientTransportType.grpc:
        return `grpc:${config.grpc.url}`;
      default:
        throw new Error('Unsupported transport');
    }
  }
}
