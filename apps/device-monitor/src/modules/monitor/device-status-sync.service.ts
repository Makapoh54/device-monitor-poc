import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppLogger, ChecksumService } from '@app/common';
import {
  DeviceClientPoolService,
  DeviceState,
  DeviceStatus,
} from '@app/device-client';
import { DiscoveredDevice } from '../discovery/discovery.types';
import { DeviceEntity } from './entities/device.entity';

@Injectable()
export class DeviceStatusSyncService {
  private readonly deviceChecksumCache = new Map<string, string>();

  constructor(
    private readonly logger: AppLogger,
    private readonly deviceClientPool: DeviceClientPoolService,
    private readonly checksumService: ChecksumService,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepository: Repository<DeviceEntity>,
  ) {
    this.logger.setContext(DeviceStatusSyncService.name);
  }

  async fetchStatus(discoveredDevice: DiscoveredDevice): Promise<DeviceStatus> {
    return this.deviceClientPool.getStatusForEndpoint({
      host: discoveredDevice.host,
    });
  }

  async validateAndUpsertStatus(
    status: DeviceStatus,
    discoveredDevice: DiscoveredDevice,
    overrideState?: DeviceState,
  ): Promise<void> {
    const { checksum, ...payload } = status;

    if (!(await this.checksumService.verifyChecksum(payload, checksum))) {
      this.logger.error(`Wrong checksum ${JSON.stringify(status)}`);
    }

    await this.upsertDeviceStatus(status, discoveredDevice, overrideState);
  }

  private async upsertDeviceStatus(
    status: DeviceStatus,
    discoveredDevice: DiscoveredDevice,
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
        isConsole: status.isConsole,
        isManaged: status.isManaged,
        startupTime: new Date(status.startupTime),
        adoptionTime: status.adoptionTime
          ? new Date(status.adoptionTime)
          : null,
        checksum: status.checksum,
        host: discoveredDevice.host,
        lastSeenAt: now,
      },
      ['mac'],
    );

    this.logger.debug(
      `Upserted device status for ${status.name} (${status.mac})`,
    );

    this.deviceChecksumCache.set(status.mac, compositeChecksum);
  }
}
