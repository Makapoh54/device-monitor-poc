import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AppLogger, ChecksumService, Retry } from '@app/common';
import {
  DeviceClientPoolService,
  DeviceStatus,
  DeviceState,
} from '@app/device-client';
import { DiscoveryService } from '../discovery/discovery.service';
import { DiscoveredDevice } from '../discovery/discovery.types';
import { DeviceEntity } from './device.entity';

@Injectable()
export class MonitorService {
  /**
   * In-memory cache of device checksums by MAC address.
   * Used to avoid unnecessary database upserts when nothing has changed.
   */
  private readonly deviceChecksumCache = new Map<string, string>();
  /**
   * Number of consecutive polling failures per device MAC.
   * Used to derive degraded/offline states.
   */
  private readonly pollFailureCountsByMac = new Map<string, number>();
  /**
   * Latest discovery snapshot keyed by container id.
   * Used by the polling cron to determine which devices are discoverable.
   */
  private latestDiscoveredDevicesByHost = new Map<string, DiscoveredDevice>();
  private hasDiscoveryRun = false;

  constructor(
    private readonly logger: AppLogger,
    private readonly discoveryService: DiscoveryService,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
    private readonly deviceClientPool: DeviceClientPoolService,
    private readonly checksumService: ChecksumService,
  ) {
    this.logger.setContext(MonitorService.name);
  }

  async fetchDeviceStatus(device: DiscoveredDevice): Promise<DeviceStatus> {
    return this.deviceClientPool.getStatusForEndpoint({
      host: device.host,
    });
  }

  @Cron('*/30 * * * * *')
  async runDiscovery(): Promise<void> {
    this.logger.debug('Starting device discovery cycle');

    const discoveredDevices = await this.discoveryService.discoverDevices();

    this.latestDiscoveredDevicesByHost = new Map(
      discoveredDevices.map((device) => [device.host, device]),
    );
    this.hasDiscoveryRun = true;

    const dbDevices = await this.deviceRepository.find();

    const dbDevicesByMac = new Map<string, DeviceEntity>();
    for (const dbDevice of dbDevices) {
      dbDevicesByMac.set(dbDevice.mac, dbDevice);
    }

    for (const discovered of discoveredDevices) {
      try {
        const status = await this.fetchDeviceStatus(discovered);
        const { checksum, ...payload } = status;

        if (!('updateAvailable' in payload)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          payload.updateAvailable = null;
        }

        if (!(await this.checksumService.verifyChecksum(payload, checksum))) {
          this.logger.error(`Wrong checksum ${JSON.stringify(status)}`);
        }
        const existing = dbDevicesByMac.get(status.mac);
        if (existing && existing.host !== discovered.host) {
          this.logger.debug(
            `Device ${status.mac} moved from host ${existing.host} to ${discovered.host}`,
          );
        }

        await this.upsertDeviceStatus(status, discovered);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.error(
          `Failed to fetch initial status for discovered device at ${discovered.httpUrl}: ${message}`,
        );
      }
    }

    const discoveredHosts = new Set(
      discoveredDevices.map((device) => device.host),
    );

    const updatedDbDevices = await this.deviceRepository.find();

    const missingDevices = updatedDbDevices.filter(
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

  @Cron('*/10 * * * * *')
  async pollDevices(): Promise<void> {
    if (!this.hasDiscoveryRun) {
      this.logger.debug(
        'Skipping polling because discovery has not completed yet',
      );
      return;
    }

    this.logger.debug('Starting device polling cycle');

    const devices = await this.deviceRepository.find();

    for (const dbDevice of devices) {
      const mac = dbDevice.mac;

      const discovered = this.latestDiscoveredDevicesByHost.get(dbDevice.host);

      if (!discovered) {
        this.pollFailureCountsByMac.delete(mac);
        if (dbDevice.state !== DeviceState.UNKOWN) {
          dbDevice.state = DeviceState.UNKOWN;
          await this.deviceRepository.save(dbDevice);
        }
        continue;
      }

      try {
        const status = await this.pollDeviceWithRetry(discovered);
        const { checksum, ...payload } = status;

        if (!('updateAvailable' in payload)) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          payload.updateAvailable = null;
        }

        if (!(await this.checksumService.verifyChecksum(payload, checksum))) {
          this.logger.error(`Wrong checksum ${JSON.stringify(status)}`);
        }
        this.pollFailureCountsByMac.delete(mac);

        await this.upsertDeviceStatus(status, discovered, DeviceState.ONLINE);
      } catch (error) {
        const previousFailures = this.pollFailureCountsByMac.get(mac) ?? 0;
        const failures = previousFailures + 1;
        this.pollFailureCountsByMac.set(mac, failures);

        const newState =
          failures <= 2 ? DeviceState.DEGRADED : DeviceState.OFFLINE;

        const message =
          error instanceof Error ? error.message : JSON.stringify(error);
        this.logger.error(
          `Failed to poll device ${dbDevice.mac} at ${discovered.httpUrl} after retries: ${message}`,
        );

        if (dbDevice.state !== newState) {
          dbDevice.state = newState;
          await this.deviceRepository.save(dbDevice);
        }
      }
    }
  }

  @Retry(3, [1000, 2000, 3000])
  private async pollDeviceWithRetry(
    discoveredDevice: DiscoveredDevice,
  ): Promise<DeviceStatus> {
    return this.fetchDeviceStatus(discoveredDevice);
  }

  private async upsertDeviceStatus(
    status: DeviceStatus,
    device: DiscoveredDevice,
    overrideState?: DeviceState,
  ): Promise<void> {
    const now = new Date();

    const effectiveState = overrideState ?? status.state;
    const previousChecksum = this.deviceChecksumCache.get(status.mac);
    const compositeChecksum = `${effectiveState}:${status.checksum}`;

    if (previousChecksum === compositeChecksum) {
      return;
    }

    await this.deviceRepository.upsert(
      {
        mac: status.mac,
        name: status.name,
        model: status.model,
        shortname: status.shortname,
        ip: status.ip,
        productLine: status.productLine,
        state: effectiveState,
        version: status.version,
        firmwareStatus: status.firmwareStatus,
        updateAvailable: status.updateAvailable,
        isConsole: status.isConsole,
        isManaged: status.isManaged,
        startupTime: new Date(status.startupTime),
        adoptionTime: status.adoptionTime
          ? new Date(status.adoptionTime)
          : null,
        checksum: status.checksum,
        host: device.host,
        lastSeenAt: now,
      },
      ['mac'],
    );

    this.logger.debug(
      `Upserted device status for ${status.name} (${status.mac})`,
    );

    this.deviceChecksumCache.set(status.mac, compositeChecksum);
  }

  async getDevices(): Promise<DeviceEntity[]> {
    return this.deviceRepository.find({
      order: { name: 'ASC' },
    });
  }
}
