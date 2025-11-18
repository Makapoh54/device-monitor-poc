export enum DeviceState {
  OFFLINE = 'offline',
  ONLINE = 'online',
  DEGRADED = 'degraded',
  UNKOWN = 'unkwown',
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
  isConsole: boolean;
  isManaged: boolean;
  startupTime: string;
  adoptionTime: string;
  checksum: string;
}
