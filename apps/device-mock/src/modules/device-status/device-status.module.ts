import { Module } from '@nestjs/common';
import { DeviceStatusService } from './device-status.controller';
import { DeviceMockStatusService } from './device-mock-status.service';
import { NetworkInfoModule } from '../network-info/network-info.module';

@Module({
  imports: [NetworkInfoModule],
  controllers: [DeviceStatusService],
  providers: [DeviceMockStatusService],
})
export class DeviceMockModule {}
