import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DeviceStatusDto } from './dto/get-device-status.dto';
import { API_ROUTES } from '../../config/consts';
import { GrpcMethod } from '@nestjs/microservices';
import { DeviceMockStatusService } from './device-mock-status.service';
import { configInstance } from '../../config';

@ApiTags('Device')
@Controller({ version: configInstance().apiVersion })
export class DeviceStatusService {
  constructor(private readonly deviceMockService: DeviceMockStatusService) {}

  @Get(API_ROUTES.DEVICE.STATUS)
  @ApiOkResponse({
    description: 'Current mocked device health status',
    type: DeviceStatusDto,
  })
  getStatusRest(): DeviceStatusDto {
    return this.deviceMockService.getStatus();
  }

  @GrpcMethod()
  getStatus(): DeviceStatusDto {
    return this.deviceMockService.getStatus();
  }
}
