import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
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
  private docker: Docker;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
    this.logger.setContext(NetworkInfoService.name);
  }

  async getContainerNetworkInfo(
    containerIdOrName: string = '',
  ): Promise<NetworkInfo> {
    const containerName = this.configService.get<string>(
      CONTAINER_NAME,
      containerIdOrName,
    );
    if (!containerName) {
      this.logger.warn(
        'Network container name missing, falling back to local network info',
      );
      return this.buildFallbackNetworkInfo(containerIdOrName);
    }
    const container = this.docker.getContainer(containerName);

    let data: Docker.ContainerInspectInfo;
    try {
      this.logger.log(
        `Inspecting container "${containerName}" for network info`,
      );
      data = await container.inspect();
    } catch (err: unknown) {
      const error = err as { statusCode?: number; message?: string };
      if (error?.statusCode === 404) {
        this.logger.warn(
          `Container not found: ${containerIdOrName}, falling back to local network info`,
        );
        return this.buildFallbackNetworkInfo(containerIdOrName);
      }
      this.logger.warn(
        error?.message ??
          'Error inspecting container, falling back to local network info',
        NetworkInfoService.name,
      );
      return this.buildFallbackNetworkInfo(containerIdOrName);
    }

    const id = data.Id;
    const name = data.Name ? data.Name.replace(/^\//, '') : null;

    const topLevelMac = data.NetworkSettings?.MacAddress || null;
    const topLevelIPv4 = data.NetworkSettings?.IPAddress || null;
    const topLevelIPv6 = data.NetworkSettings?.GlobalIPv6Address || null;

    const networksRaw = data.NetworkSettings?.Networks ?? {};
    const networks: NetworkAddressInfo[] = [];

    for (const [networkName, net] of Object.entries(networksRaw)) {
      networks.push({
        networkName,
        macAddress: net?.MacAddress || null,
        ipv4Address: net?.IPAddress || null,
        ipv6Address: net?.GlobalIPv6Address || null,
      });
    }

    let effectiveIPv4 = topLevelIPv4;
    let effectiveIPv6 = topLevelIPv6;
    let effectiveMac = topLevelMac;

    if ((!effectiveIPv4 || !effectiveMac) && networks.length > 0) {
      const primary = networks[0];
      effectiveIPv4 = effectiveIPv4 || primary.ipv4Address;
      effectiveIPv6 = effectiveIPv6 || primary.ipv6Address;
      effectiveMac = effectiveMac || primary.macAddress;
    }

    const result: NetworkInfo = {
      id,
      name,
      macAddress: effectiveMac,
      ipv4Address: effectiveIPv4,
      ipv6Address: effectiveIPv6,
      networks,
    };

    this.logger.debug(
      `Container network info: mac=${result.macAddress}, ipv4=${result.ipv4Address}`,
      NetworkInfoService.name,
    );

    return result;
  }

  private buildFallbackNetworkInfo(containerIdOrName?: string): NetworkInfo {
    return {
      id: containerIdOrName ?? 'local',
      name: containerIdOrName ?? 'local',
      macAddress: null,
      ipv4Address: '127.0.0.1',
      ipv6Address: null,
      networks: [],
    };
  }
}
