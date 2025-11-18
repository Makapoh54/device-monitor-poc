import { DeviceStatus } from '../dto/device-status.dto';
import { DeviceClientTransport } from './device-client.transport';

export interface RestTransportConfig {
  baseUrl: string;
}

export class RestDeviceClientTransport implements DeviceClientTransport {
  constructor(private readonly config: RestTransportConfig) {}

  async getStatus(): Promise<DeviceStatus> {
    const baseUrl = this.config.baseUrl.replace(/\/+$/, '');

    const url = new URL(`${baseUrl}/v1/device/status`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`REST getStatus failed with status ${response.status}`);
    }

    const data = (await response.json()) as DeviceStatus;
    return data;
  }
}
