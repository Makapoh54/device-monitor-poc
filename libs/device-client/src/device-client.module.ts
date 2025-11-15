import {
  DynamicModule,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';
import {
  DEVICE_CLIENT_OPTIONS,
  DEVICE_CLIENT_TRANSPORT,
  DeviceClientModuleOptions,
  DeviceClientService,
  DeviceClientTransportType,
} from './device-client.service';
import {
  GrpcDeviceClientTransport,
  RestDeviceClientTransport,
} from './transport';

export interface DeviceClientModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (
    ...args: any[]
  ) => Promise<DeviceClientModuleOptions> | DeviceClientModuleOptions;
  inject?: any[];
}

@Module({})
export class DeviceClientModule {
  static forRootAsync(options: DeviceClientModuleAsyncOptions): DynamicModule {
    const asyncOptionsProvider: Provider = {
      provide: DEVICE_CLIENT_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    const transportProvider: Provider = {
      provide: DEVICE_CLIENT_TRANSPORT,
      useFactory: (moduleOptions: DeviceClientModuleOptions) => {
        switch (moduleOptions.transport) {
          case DeviceClientTransportType.rest: {
            return new RestDeviceClientTransport(moduleOptions.rest);
          }
          case DeviceClientTransportType.grpc: {
            return new GrpcDeviceClientTransport(moduleOptions.grpc);
          }
          default:
            throw new Error('Unsupported transport');
        }
      },
      inject: [DEVICE_CLIENT_OPTIONS],
    };

    return {
      module: DeviceClientModule,
      imports: options.imports ?? [],
      providers: [DeviceClientService, asyncOptionsProvider, transportProvider],
      exports: [DeviceClientService],
    };
  }
}
