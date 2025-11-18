import { Injectable } from '@nestjs/common';
import * as os from 'os';
import { CONTAINER_NAME } from '../../config/consts';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '@app/common';

export interface NetworkAddressInfo {
  networkName: string;
  macAddress: string | null;
  ipv4Address: string | null;
  ipv6Address: string | null;
}

export interface NetworkInfo {
  id: string;
  name: string | null;
  macAddress: string | null;
  ipv4Address: string | null;
  ipv6Address: string | null;
  networks: NetworkAddressInfo[];
}

@Injectable()
export class NetworkInfoService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(NetworkInfoService.name);
  }

  getContainerNetworkInfo(containerIdOrName: string = ''): NetworkInfo {
    const containerName =
      this.configService.get<string>(CONTAINER_NAME, containerIdOrName) ??
      containerIdOrName;

    this.logger.debug(
      `Using OS network interfaces for network info (containerName="${containerName}")`,
      NetworkInfoService.name,
    );

    return this.buildNetworkInfo(containerName || 'local');
  }

  private buildNetworkInfo(containerIdOrName?: string): NetworkInfo {
    const interfaces = os.networkInterfaces();

    const networks: NetworkAddressInfo[] = [];
    let macAddress: string | null = null;
    let ipv4Address: string | null = null;
    let ipv6Address: string | null = null;

    for (const [networkName, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;

      let netMac: string | null = null;
      let netIPv4: string | null = null;
      let netIPv6: string | null = null;

      for (const addr of addrs) {
        if (addr.internal) continue;

        if (!netMac && addr.mac && addr.mac !== '00:00:00:00:00:00') {
          netMac = addr.mac;
        }

        if (addr.family === 'IPv4') {
          netIPv4 = addr.address;
        } else if (addr.family === 'IPv6') {
          netIPv6 = addr.address;
        }
      }

      if (netIPv4 || netIPv6) {
        networks.push({
          networkName,
          macAddress: netMac,
          ipv4Address: netIPv4,
          ipv6Address: netIPv6,
        });

        if (!ipv4Address && netIPv4) ipv4Address = netIPv4;
        if (!ipv6Address && netIPv6) ipv6Address = netIPv6;
        if (!macAddress && netMac) macAddress = netMac;
      }
    }

    return {
      id: containerIdOrName ?? 'local',
      name: containerIdOrName ?? 'local',
      macAddress,
      ipv4Address,
      ipv6Address,
      networks,
    };
  }
}
