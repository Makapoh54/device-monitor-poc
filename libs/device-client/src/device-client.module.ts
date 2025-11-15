import { Module } from '@nestjs/common';
import { DeviceClientPoolService } from './device-client.pool.service';

@Module({
  providers: [DeviceClientPoolService],
  exports: [DeviceClientPoolService],
})
export class DeviceClientModule {}
