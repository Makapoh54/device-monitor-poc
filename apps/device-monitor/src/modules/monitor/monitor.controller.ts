import { Controller, Get } from '@nestjs/common';
import { DeviceEntity } from './device.entity';
import { MonitorService } from './monitor.service';

@Controller('devices')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get()
  async getDevices(): Promise<DeviceEntity[]> {
    return this.monitorService.getDevices();
  }
}
