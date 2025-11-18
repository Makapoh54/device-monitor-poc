import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DeviceStatusDto } from './dto/get-device-status.dto';
import { API_ROUTES } from '../../config/consts';
import { GrpcMethod } from '@nestjs/microservices';
import { DeviceEmulatorStatusService } from './device-emulator-status.service';
import { configInstance } from '../../config';

@ApiTags('Device')
@Controller({ version: configInstance().apiVersion })
export class DeviceStatusService {
  constructor(
    private readonly deviceEmulatorService: DeviceEmulatorStatusService,
  ) {}

  @Get(API_ROUTES.DEVICE.STATUS)
  @ApiOkResponse({
    description: 'Current emulated device health status',
    type: DeviceStatusDto,
  })
  async getStatusRest(): Promise<DeviceStatusDto> {
    return this.deviceEmulatorService.getStatus();
  }

  @GrpcMethod()
  async getStatus(): Promise<DeviceStatusDto> {
    return this.deviceEmulatorService.getStatus();
  }
}
