export enum DeviceState {
  'offline',
  'online',
  'degraded',
  'unkwown',
}

export interface DeviceStatus {
  mac: string;
  name: string;
  model: string;
  shortname: string;
  ip: string;
  productLine: string;
  state: DeviceState;
  version: string;
  firmwareStatus: string;
  updateAvailable: string | null;
  isConsole: boolean;
  isManaged: boolean;
  startupTime: string;
  adoptionTime: string | null;
  checksum: string;
}
