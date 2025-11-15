export type DeviceBehaviour = 'stable' | 'degraded' | 'down';

export type DeviceMeta = {
  version: string;
  firmwareStatus: string;
  productLine: string;
  shortname: string;
  model: string;
  name: string;
  isManaged: boolean;
  adoptionTime: string | null;
  behaviour: DeviceBehaviour;
};
