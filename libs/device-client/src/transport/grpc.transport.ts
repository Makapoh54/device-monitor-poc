import { join } from 'path';
import { Observable, firstValueFrom } from 'rxjs';
import {
  ClientGrpc,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { DeviceStatus } from '../dto/device-status.dto';
import { DeviceClientTransport } from './device-client.transport';

export interface GrpcTransportConfig {
  /**
   * gRPC URL of the device-mock service, e.g. "localhost:50051".
   */
  url: string;
  /**
   * Optional custom proto path. Defaults to the proto shipped with this library.
   */
  protoPath?: string;
}

interface DeviceStatusGrpcService {
  getStatus(request: Record<string, unknown>): Observable<DeviceStatus>;
}

export class GrpcDeviceClientTransport implements DeviceClientTransport {
  private readonly client: ClientGrpc;
  private readonly service: DeviceStatusGrpcService;

  constructor(private readonly config: GrpcTransportConfig) {
    const protoPath =
      this.config.protoPath ??
      join(
        process.cwd(),
        'libs',
        'device-client',
        'src',
        'dto',
        'device-status.proto',
      );

    this.client = ClientProxyFactory.create({
      transport: Transport.GRPC,
      options: {
        url: this.config.url,
        package: 'device',
        protoPath,
      },
    });

    this.service = this.client.getService<DeviceStatusGrpcService>(
      'DeviceStatusService',
    );
  }

  async getStatus(): Promise<DeviceStatus> {
    return await firstValueFrom(this.service.getStatus({}));
  }
}
