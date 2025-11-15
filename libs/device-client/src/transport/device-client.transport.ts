import { DeviceStatus } from '../dto/device-status.dto';

export interface DeviceClientTransport {
  getStatus(): Promise<DeviceStatus>;
}
