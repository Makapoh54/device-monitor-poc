import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { DeviceMockModule } from './modules/device-status/device-status.module';
import { NetworkInfoModule } from './modules/network-info/network-info.module';
import { configInstance } from './config';
import { LoggerModule } from '@app/common';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configInstance],
      isGlobal: true,
      envFilePath: join(process.cwd(), 'apps', 'device-mock', '.env'),
    }),
    LoggerModule,
    DeviceMockModule,
    NetworkInfoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
