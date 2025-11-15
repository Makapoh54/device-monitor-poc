import { Module } from '@nestjs/common';
import { DeviceStatusService } from './device-status.controller';
import { DeviceMockStatusService } from './device-mock-status.service';
import { NetworkInfoModule } from '../network-info/network-info.module';
import { ChecksumService } from '../../../../../libs/common/src';

@Module({
  imports: [NetworkInfoModule],
  controllers: [DeviceStatusService],
  providers: [DeviceMockStatusService, ChecksumService],
})
export class DeviceMockModule {}
