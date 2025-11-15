import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '@app/common';
import { DeviceClientModule } from '@app/device-client';
import { DiscoveryModule } from '../discovery/discovery.module';
import { DeviceEntity } from './device.entity';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';

@Module({
  imports: [
    LoggerModule,
    DiscoveryModule,
    TypeOrmModule.forFeature([DeviceEntity]),
    DeviceClientModule,
  ],
  providers: [MonitorService],
  controllers: [MonitorController],
})
export class MonitorModule {}
