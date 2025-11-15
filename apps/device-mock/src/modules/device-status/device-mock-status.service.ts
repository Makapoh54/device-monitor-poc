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
import { AppLogger, ChecksumService } from '@app/common';
import { DeviceStatus, DeviceState } from '@app/device-client';

@Injectable()
export class DeviceMockStatusService
  implements OnModuleInit, OnApplicationBootstrap
{
  private startDate: Date;
  private deviceMeta: DeviceMeta;
  private networkInfo: NetworkInfo;
  private downAfterMs: number | null = null;
  private degradedOfflineWindowSeconds: number | null = null;

  constructor(
    private readonly logger: AppLogger,
    private readonly networkInfoService: NetworkInfoService,
    private readonly configService: ConfigService,
    private readonly checksumService: ChecksumService,
  ) {
    this.logger.setContext(DeviceMockStatusService.name);
  }

  onModuleInit() {
    this.startDate = new Date();
    this.deviceMeta = this.configService.get<DeviceMeta>(
      DEVICE_META,
    ) as DeviceMeta;

    if (this.deviceMeta.behaviour === 'down') {
      const seconds = 20 + Math.floor(Math.random() * (60 - 20 + 1)); // 20-60 seconds
      this.downAfterMs = seconds * 1000;
      this.logger.debug(
        `Down behaviour enabled, will stop responding after ${seconds}s`,
        DeviceMockStatusService.name,
      );
    }

    if (this.deviceMeta.behaviour === 'degraded') {
      const seconds = 2 + Math.floor(Math.random() * (7 - 2 + 1)); // 2-7 seconds
      this.degradedOfflineWindowSeconds = seconds;
      this.logger.debug(
        `Degraded behaviour enabled, will be offline ~${seconds}s every 15s`,
        DeviceMockStatusService.name,
      );
    }
  }

  onApplicationBootstrap() {
    this.networkInfo = this.networkInfoService.getContainerNetworkInfo();
  }

  private async computeChecksum(
    status: Omit<DeviceStatus, 'checksum'>,
  ): Promise<string> {
    return this.checksumService.checksum(JSON.stringify(status));
  }

  async getStatus(): Promise<DeviceStatus> {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startDate.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const behaviour = this.deviceMeta.behaviour || 'stable';

    if (behaviour === 'down' && this.downAfterMs != null) {
      if (uptimeMs >= this.downAfterMs) {
        this.logger.warn(
          `Simulating down behaviour, rejecting status after ${uptimeSeconds}s`,
          DeviceMockStatusService.name,
        );
        throw new Error('Simulated device down');
      }
    }

    if (behaviour === 'degraded' && this.degradedOfflineWindowSeconds != null) {
      const periodSeconds = 15;
      const secondsIntoPeriod = uptimeSeconds % periodSeconds;

      if (
        secondsIntoPeriod >=
        periodSeconds - this.degradedOfflineWindowSeconds
      ) {
        this.logger.warn(
          `Simulating degraded offline window (${this.degradedOfflineWindowSeconds}s every ${periodSeconds}s), rejecting status at uptime ${uptimeSeconds}s`,
          DeviceMockStatusService.name,
        );
        throw new Error('Simulated intermittent degraded offline window');
      }
    }

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

    let state: DeviceState;
    switch (behaviour) {
      case 'degraded':
        state = DeviceState.DEGRADED;
        break;
      case 'down':
        // While still responding (before downAfterMs), treat as online.
        state = DeviceState.ONLINE;
        break;
      case 'stable':
      default:
        state = DeviceState.ONLINE;
        break;
    }

    const config = {
      mac: this.networkInfo.macAddress || '',
      name,
      model,
      shortname,
      ip: this.networkInfo.ipv4Address || '',
      productLine,
      state,
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

    const checksum = await this.computeChecksum(config);

    return {
      ...config,
      checksum,
    };
  }
}
