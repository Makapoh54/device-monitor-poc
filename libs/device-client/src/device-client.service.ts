import { Inject, Injectable } from '@nestjs/common';
import { RestTransportConfig, GrpcTransportConfig } from './transport';
import { DeviceStatus } from './dto/device-status.dto';
import { DeviceClientTransport } from './transport/device-client.transport';

export enum DeviceClientTransportType {
  rest,
  grpc,
}

export type DeviceClientModuleOptions =
  | { transport: DeviceClientTransportType.rest; rest: RestTransportConfig }
  | { transport: DeviceClientTransportType.grpc; grpc: GrpcTransportConfig };

export const DEVICE_CLIENT_OPTIONS = Symbol('DEVICE_CLIENT_OPTIONS');
export const DEVICE_CLIENT_TRANSPORT = Symbol('DEVICE_CLIENT_TRANSPORT');

@Injectable()
export class DeviceClientService {
  constructor(
    @Inject(DEVICE_CLIENT_TRANSPORT)
    private readonly transport: DeviceClientTransport,
  ) {}

  getStatus(): Promise<DeviceStatus> {
    return this.transport.getStatus();
  }
}
