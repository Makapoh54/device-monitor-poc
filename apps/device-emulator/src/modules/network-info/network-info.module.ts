import { Module } from '@nestjs/common';
import { NetworkInfoService } from './network-info.service';

@Module({
  providers: [NetworkInfoService],
  exports: [NetworkInfoService],
})
export class NetworkInfoModule {}
