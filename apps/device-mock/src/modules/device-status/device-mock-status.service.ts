import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEVICE_META, DeviceMeta } from '../../config/consts';
import {
  NetworkInfo,
  NetworkInfoService,
} from '../network-info/network-info.service';
import { AppLogger } from '@app/common';
import { DeviceStatus, DeviceState } from '@app/device-client';

@Injectable()
export class DeviceMockStatusService
  implements OnModuleInit, OnApplicationBootstrap
{
  private startDate: Date;
  private deviceMeta: DeviceMeta;
  private networkInfo: NetworkInfo;

  constructor(
    private readonly logger: AppLogger,
    private readonly networkInfoService: NetworkInfoService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(DeviceMockStatusService.name);
  }

  onModuleInit() {
    this.startDate = new Date();
    this.deviceMeta = this.configService.get<DeviceMeta>(
      DEVICE_META,
    ) as DeviceMeta;
  }

  async onApplicationBootstrap() {
    this.networkInfo = await this.networkInfoService.getContainerNetworkInfo();
  }

  getStatus(): DeviceStatus {
    const {
      version,
      firmwareStatus,
      productLine,
      shortname,
      model,
      name,
      isManaged,
      adoptionTime,
    } = this.deviceMeta;

    const config = {
      mac: this.networkInfo.macAddress || '',
      name,
      model,
      shortname,
      ip: this.networkInfo.ipv4Address || '',
      productLine,
      state: DeviceState.online,
      version,
      firmwareStatus,
      updateAvailable: null,
      isConsole: true,
      isManaged,
      startupTime: this.startDate.toISOString(),
      adoptionTime,
    };

    this.logger.debug(
      `Returning device status for ${name} (${productLine})`,
      DeviceMockStatusService.name,
    );

    return { ...config, checksum: '123' };
  }
}
