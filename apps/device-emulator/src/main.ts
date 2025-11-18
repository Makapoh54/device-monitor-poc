import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import helmet from '@fastify/helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppLogger } from '@app/common';
import { configInstance } from './config';
import { VersioningType } from '@nestjs/common';

function setupSwagger(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Device Emulator API')
    .setDescription('REST emulator device endpoints')
    .setVersion(configInstance().version)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const appLogger = await app.resolve(AppLogger);

  const configService = app.get(ConfigService);
  const httpPort = configService.get<number>('httpPort') ?? 3000;
  const grpcPort = configService.get<number>('grpcPort') ?? 50051;
  const isGrpcEnabled = configService.get<boolean>('isGrpcEnabled') ?? false;

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  app.enableVersioning({
    type: VersioningType.URI,
  });
  setupSwagger(app);

  if (isGrpcEnabled) {
    appLogger.log(
      `Starting gRPC microservice on port ${grpcPort}`,
      'Bootstrap',
    );
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'device',
        protoPath: join(
          process.cwd(),
          'libs',
          'device-client',
          'src',
          'dto',
          'device-status.proto',
        ),
        url: `0.0.0.0:${grpcPort}`,
      },
    });

    await app.startAllMicroservices();
  } else {
    appLogger.log('gRPC microservice disabled for this emulator', 'Bootstrap');
  }
  appLogger.log(`Starting HTTP server on port ${httpPort}`, 'Bootstrap');
  await app.listen({
    port: httpPort,
    host: '0.0.0.0',
  });
}
bootstrap();
