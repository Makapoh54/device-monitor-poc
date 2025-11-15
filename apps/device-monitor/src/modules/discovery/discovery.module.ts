import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@app/common';
import { DiscoveryService } from './discovery.service';
import { DockerSocketDiscoveryStrategy } from './strategies/docker-socket.strategy';

@Module({
  imports: [LoggerModule, ConfigModule],
  providers: [DiscoveryService, DockerSocketDiscoveryStrategy],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
