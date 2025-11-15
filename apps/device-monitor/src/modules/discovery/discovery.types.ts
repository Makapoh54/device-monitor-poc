export interface DiscoveredDevice {
  id: string;
  name: string;
  host: string;
  httpUrl: string;
}

export interface DiscoveryStrategy {
  name: string;
  discover(): Promise<DiscoveredDevice[]>;
}
