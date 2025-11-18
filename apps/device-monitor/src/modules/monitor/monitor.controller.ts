import { Controller, Get } from '@nestjs/common';
import { DeviceEntity } from './entities/device.entity';
import { MonitorService } from './monitor.service';
import { configInstance } from '../../config';

@Controller({ path: 'devices', version: configInstance().apiVersion })
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get()
  async getDevices(): Promise<DeviceEntity[]> {
    return this.monitorService.getDevices();
  }
}
