import { Module } from '@nestjs/common';
import { DeviceStatusService } from './device-status.controller';
import { DeviceEmulatorStatusService } from './device-emulator-status.service';
import { NetworkInfoModule } from '../network-info/network-info.module';
import { ChecksumService } from '../../../../../libs/common/src';

@Module({
  imports: [NetworkInfoModule],
  controllers: [DeviceStatusService],
  providers: [DeviceEmulatorStatusService, ChecksumService],
})
export class DeviceEmulatorModule {}
