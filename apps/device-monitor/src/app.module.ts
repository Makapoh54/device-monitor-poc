import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { LoggerModule } from '@app/common';
import { MonitorModule } from './modules/monitor/monitor.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { DeviceEntity } from './modules/monitor/entities/device.entity';
import { configInstance, PostgresConfig, POSTGRES_CONFIG } from './config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configInstance],
      isGlobal: true,
      envFilePath: join(process.cwd(), 'apps', 'device-monitor', '.env'),
    }),
    LoggerModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const postgresConfig = configService.get<PostgresConfig>(
          POSTGRES_CONFIG,
        ) as PostgresConfig;

        return {
          type: 'postgres',
          host: postgresConfig.host,
          port: postgresConfig.port,
          username: postgresConfig.username,
          password: postgresConfig.password,
          database: postgresConfig.database,
          entities: [DeviceEntity],
          synchronize: true, // TODO remove in prod
          autoLoadEntities: true,
        };
      },
    }),
    ScheduleModule.forRoot(),
    DiscoveryModule,
    MonitorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
