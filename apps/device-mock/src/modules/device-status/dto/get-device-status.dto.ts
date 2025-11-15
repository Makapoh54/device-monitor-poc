import { ApiProperty } from '@nestjs/swagger';
import { DeviceStatus, DeviceState } from '@app/device-client';

export class DeviceStatusDto implements DeviceStatus {
  @ApiProperty({
    description: 'MAC address of the device',
    example: 'F4E2C6C23F13',
  })
  mac: string;

  @ApiProperty({
    description: 'Display name / hostname of the device',
    example: 'unifi.yourdomain.com',
  })
  name: string;

  @ApiProperty({
    description: 'Device model name',
    example: 'UDM SE',
  })
  model: string;

  @ApiProperty({
    description: 'Short model identifier',
    example: 'UDMPROSE',
  })
  shortname: string;

  @ApiProperty({
    description: 'IP address of the device',
    example: '192.168.1.226',
  })
  ip: string;

  @ApiProperty({
    description: 'Product line the device belongs to',
    example: 'network',
  })
  productLine: string;

  @ApiProperty({
    description: 'Current online state of the device',
    example: 'online',
    enum: DeviceState,
  })
  state: DeviceState;

  @ApiProperty({
    description: 'Reported software version',
    example: '4.1.13',
  })
  version: string;

  @ApiProperty({
    description: 'Firmware update status',
    example: 'upToDate',
  })
  firmwareStatus: string;

  @ApiProperty({
    description: 'Version string of an available update, if any',
    example: null,
    nullable: true,
    type: String,
  })
  updateAvailable: string | null;

  @ApiProperty({
    description: 'Indicates if the device is a console',
    example: true,
  })
  isConsole: boolean;

  @ApiProperty({
    description: 'Indicates if the device is managed',
    example: true,
  })
  isManaged: boolean;

  @ApiProperty({
    description: 'ISO timestamp when the device started',
    example: '2024-06-19T13:41:43Z',
  })
  startupTime: string;

  @ApiProperty({
    description: 'ISO timestamp when the device was adopted',
    example: null,
    nullable: true,
    type: String,
  })
  adoptionTime: string | null;

  @ApiProperty({
    description: 'Checksum representing the configuration / state',
    example: 'mock-checksum-123456',
  })
  checksum: string;
}
