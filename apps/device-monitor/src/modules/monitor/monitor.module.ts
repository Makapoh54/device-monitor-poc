import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecksumService, LoggerModule } from '@app/common';
import { DeviceClientModule } from '@app/device-client';
import { DiscoveryModule } from '../discovery/discovery.module';
import { DeviceEntity } from './entities/device.entity';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { DeviceStatusSyncService } from './device-status-sync.service';

@Module({
  imports: [
    LoggerModule,
    DiscoveryModule,
    TypeOrmModule.forFeature([DeviceEntity]),
    DeviceClientModule,
  ],
  providers: [MonitorService, DeviceStatusSyncService, ChecksumService],
  controllers: [MonitorController],
})
export class MonitorModule {}
