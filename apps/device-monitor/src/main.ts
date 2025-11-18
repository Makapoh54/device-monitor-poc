import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import compression from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppLogger } from '@app/common';
import { configInstance } from './config';

function setupSwagger(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Device Monitor API')
    .setDescription('Device discovery and monitoring endpoints')
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

  app.enableVersioning({
    type: VersioningType.URI,
  });

  const appLogger = await app.resolve(AppLogger);
  const configService = app.get(ConfigService);
  const httpPort = configService.get<number>('httpPort') ?? 3000;

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(compression, { encodings: ['gzip', 'deflate'] });
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/',
  });

  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.get('/', (_request, reply) => {
    reply.type('text/html').sendFile('index.html');
  });

  setupSwagger(app);

  appLogger.log(`Starting HTTP server on port ${httpPort}`, 'Bootstrap');
  await app.listen({
    port: httpPort,
    host: '0.0.0.0',
  });
}

bootstrap();
