import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AppLogger, Retry } from '@app/common';
import { DeviceStatus, DeviceState } from '@app/device-client';
import { DiscoveryService } from '../discovery/discovery.service';
import { DiscoveredDevice } from '../discovery/discovery.types';
import { DeviceEntity } from './entities/device.entity';
import { DeviceStatusSyncService } from './device-status-sync.service';

@Injectable()
export class MonitorService {
  private static readonly MAX_DEGRADED_FAILURES = 2;

  private readonly pollFailureCountsByMac = new Map<string, number>();
  private latestDiscoveredDevicesByHost = new Map<string, DiscoveredDevice>();

  private hasDiscoveryRun = false;

  constructor(
    private readonly logger: AppLogger,
    private readonly discoveryService: DiscoveryService,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    private readonly deviceStatusSyncService: DeviceStatusSyncService,
  ) {
    this.logger.setContext(MonitorService.name);
  }

  @Cron('*/30 * * * * *')
  async runDiscovery(): Promise<void> {
    this.logger.debug('Starting device discovery cycle');

    const discoveredDevices = await this.discoveryService.discoverDevices();

    this.updateLatestDiscoveredSnapshot(discoveredDevices);

    const dbDevices = await this.deviceRepository.find();

    await this.syncDiscoveredDevices(discoveredDevices, dbDevices);
    await this.markMissingDevicesAsUnknown(discoveredDevices, dbDevices);
  }

  @Cron('*/10 * * * * *')
  async pollDevices(): Promise<void> {
    if (!this.hasDiscoveryRun) {
      this.logger.debug(
        'Skipping polling because discovery has not completed yet',
      );
      return;
    }

    this.logger.debug('Starting device polling cycle');

    const dbDevices = await this.deviceRepository.find();

    for (const dbDevice of dbDevices) {
      const discoveredDevice = this.latestDiscoveredDevicesByHost.get(
        dbDevice.host,
      );

      if (!discoveredDevice) {
        await this.handleUndiscoveredDevice(dbDevice);
        continue;
      }

      try {
        const status = await this.pollDeviceWithRetry(discoveredDevice);

        await this.validateAndUpsertStatus(
          status,
          discoveredDevice,
          DeviceState.ONLINE,
        );

        this.pollFailureCountsByMac.delete(dbDevice.mac);
      } catch (error) {
        await this.handlePollFailure(dbDevice, discoveredDevice, error);
      }
    }
  }

  @Retry(3, [1000, 2000, 3000])
  private async pollDeviceWithRetry(
    discoveredDevice: DiscoveredDevice,
  ): Promise<DeviceStatus> {
    return this.deviceStatusSyncService.fetchStatus(discoveredDevice);
  }

  async getDevices(): Promise<DeviceEntity[]> {
    return this.deviceRepository.find({
      order: { name: 'ASC' },
    });
  }

  private updateLatestDiscoveredSnapshot(
    discoveredDevices: DiscoveredDevice[],
  ): void {
    this.latestDiscoveredDevicesByHost = new Map(
      discoveredDevices.map((device) => [device.host, device]),
    );
    this.hasDiscoveryRun = true;
  }

  private async syncDiscoveredDevices(
    discoveredDevices: DiscoveredDevice[],
    dbDevices: DeviceEntity[],
  ): Promise<void> {
    const dbDevicesByMac = new Map<string, DeviceEntity>();
    for (const dbDevice of dbDevices) {
      dbDevicesByMac.set(dbDevice.mac, dbDevice);
    }

    for (const discoveredDevice of discoveredDevices) {
      try {
        const status =
          await this.deviceStatusSyncService.fetchStatus(discoveredDevice);

        await this.validateAndUpsertStatus(status, discoveredDevice);

        const existing = dbDevicesByMac.get(status.mac);
        if (existing && existing.host !== discoveredDevice.host) {
          this.logger.debug(
            `Device ${status.mac} moved from host ${existing.host} to ${discoveredDevice.host}`,
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.error(
          `Failed to fetch initial status for discovered device at ${discoveredDevice.httpUrl}: ${message}`,
        );
      }
    }
  }

  private async markMissingDevicesAsUnknown(
    discoveredDevices: DiscoveredDevice[],
    dbDevices: DeviceEntity[],
  ): Promise<void> {
    const discoveredHosts = new Set(
      discoveredDevices.map((device) => device.host),
    );

    const missingDevices = dbDevices.filter(
      (device) => !discoveredHosts.has(device.host),
    );

    for (const missing of missingDevices) {
      this.pollFailureCountsByMac.delete(missing.mac);
      if (missing.state !== DeviceState.UNKOWN) {
        missing.state = DeviceState.UNKOWN;
        await this.deviceRepository.save(missing);
      }
    }
  }

  private async validateAndUpsertStatus(
    status: DeviceStatus,
    discoveredDevice: DiscoveredDevice,
    overrideState?: DeviceState,
  ): Promise<void> {
    await this.deviceStatusSyncService.validateAndUpsertStatus(
      status,
      discoveredDevice,
      overrideState,
    );
  }

  private async handleUndiscoveredDevice(
    dbDevice: DeviceEntity,
  ): Promise<void> {
    this.pollFailureCountsByMac.delete(dbDevice.mac);
    if (dbDevice.state !== DeviceState.UNKOWN) {
      dbDevice.state = DeviceState.UNKOWN;
      await this.deviceRepository.save(dbDevice);
    }
  }

  private async handlePollFailure(
    dbDevice: DeviceEntity,
    discoveredDevice: DiscoveredDevice,
    error: unknown,
  ): Promise<void> {
    const previousFailures = this.pollFailureCountsByMac.get(dbDevice.mac) ?? 0;
    const failures = previousFailures + 1;
    this.pollFailureCountsByMac.set(dbDevice.mac, failures);

    const newState =
      failures <= MonitorService.MAX_DEGRADED_FAILURES
        ? DeviceState.DEGRADED
        : DeviceState.OFFLINE;

    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    this.logger.error(
      `Failed to poll device ${dbDevice.mac} at ${discoveredDevice.httpUrl} after retries: ${message}`,
    );

    if (dbDevice.state !== newState) {
      dbDevice.state = newState;
      await this.deviceRepository.save(dbDevice);
    }
  }
}
