import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEVICE_META, DeviceBehaviour, DeviceMeta } from '../../config/consts';
import {
  NetworkInfo,
  NetworkInfoService,
} from '../network-info/network-info.service';
import { AppLogger, ChecksumService } from '@app/common';
import { DeviceStatus, DeviceState } from '@app/device-client';

@Injectable()
export class DeviceEmulatorStatusService
  implements OnModuleInit, OnApplicationBootstrap
{
  private startDate: Date;
  private deviceMeta: DeviceMeta;
  private networkInfo: NetworkInfo;
  private downAfterMs: number | null = null;
  private degradedOfflineWindowSeconds: number | null = null;
  private behaviour: DeviceBehaviour = DeviceBehaviour.STABLE;

  constructor(
    private readonly logger: AppLogger,
    private readonly networkInfoService: NetworkInfoService,
    private readonly configService: ConfigService,
    private readonly checksumService: ChecksumService,
  ) {
    this.logger.setContext(DeviceEmulatorStatusService.name);
  }

  onModuleInit() {
    this.startDate = new Date();
    this.deviceMeta = this.configService.get<DeviceMeta>(
      DEVICE_META,
    ) as DeviceMeta;
    this.behaviour = this.deviceMeta.behaviour ?? DeviceBehaviour.STABLE;

    this.initializeBehaviour();
  }

  onApplicationBootstrap() {
    this.networkInfo = this.networkInfoService.getContainerNetworkInfo();
  }

  async getStatus(): Promise<DeviceStatus> {
    const now = new Date();
    const uptimeMs = now.getTime() - this.startDate.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    this.applyBehaviourOrThrow(uptimeMs, uptimeSeconds);

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
      state: this.getDeviceState(),
      version,
      firmwareStatus,
      isConsole: true,
      isManaged,
      startupTime: this.startDate.toISOString(),
      adoptionTime: adoptionTime ?? '',
    };

    this.logger.debug(`Returning device status for ${name} (${productLine})`);

    const checksum = await this.computeChecksum(config);

    return {
      ...config,
      checksum,
    };
  }

  private async computeChecksum(
    status: Omit<DeviceStatus, 'checksum'>,
  ): Promise<string> {
    return this.checksumService.checksum(status);
  }

  private initializeBehaviour(): void {
    switch (this.behaviour) {
      case DeviceBehaviour.DOWN:
        this.initializeDownBehaviour();
        break;
      case DeviceBehaviour.DEGRADED:
        this.initializeDegradedBehaviour();
        break;
      case DeviceBehaviour.STABLE:
      default:
        break;
    }
  }

  private initializeDownBehaviour(): void {
    const seconds = 20 + Math.floor(Math.random() * (60 - 20 + 1)); // 20-60 seconds
    this.downAfterMs = seconds * 1000;
    this.logger.debug(
      `Down behaviour enabled, will stop responding after ${seconds}s`,
    );
  }

  private initializeDegradedBehaviour(): void {
    const seconds = 2 + Math.floor(Math.random() * (7 - 2 + 1)); // 2-7 seconds
    this.degradedOfflineWindowSeconds = seconds;
    this.logger.debug(
      `Degraded behaviour enabled, will be offline ~${seconds}s every 15s`,
    );
  }

  private applyBehaviourOrThrow(uptimeMs: number, uptimeSeconds: number): void {
    switch (this.behaviour) {
      case DeviceBehaviour.DOWN:
        this.applyDownBehaviourOrThrow(uptimeMs, uptimeSeconds);
        break;
      case DeviceBehaviour.DEGRADED:
        this.applyDegradedBehaviourOrThrow(uptimeSeconds);
        break;
      case DeviceBehaviour.STABLE:
      default:
        break;
    }
  }

  private applyDownBehaviourOrThrow(
    uptimeMs: number,
    uptimeSeconds: number,
  ): void {
    if (this.downAfterMs === null || uptimeMs < this.downAfterMs) {
      return;
    }

    this.logger.warn(
      `Simulating down behaviour, rejecting status after ${uptimeSeconds}s`,
    );
    throw new Error('Simulated device down');
  }

  private applyDegradedBehaviourOrThrow(uptimeSeconds: number): void {
    const periodSeconds = 15;
    const secondsIntoPeriod = uptimeSeconds % periodSeconds;

    if (
      this.degradedOfflineWindowSeconds == null ||
      secondsIntoPeriod < periodSeconds - this.degradedOfflineWindowSeconds
    ) {
      return;
    }

    this.logger.warn(
      `Simulating degraded offline window (${this.degradedOfflineWindowSeconds}s every ${periodSeconds}s), rejecting status at uptime ${uptimeSeconds}s`,
    );
    throw new Error('Simulated intermittent degraded offline window');
  }

  private getDeviceState(): DeviceState {
    switch (this.behaviour) {
      case DeviceBehaviour.DEGRADED:
        return DeviceState.DEGRADED;
      case DeviceBehaviour.DOWN:
      case DeviceBehaviour.STABLE:
      default:
        return DeviceState.ONLINE;
    }
  }
}
