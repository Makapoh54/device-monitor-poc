import {
  DEVELOPMENT_ENV,
  DEVICE_META,
  PRODUCTION_ENV,
  STAGE_ENV,
  TEST_ENV,
  DeviceMeta,
  CONTAINER_NAME,
} from './consts';

export class Config {
  readonly version: string = process.env.npm_package_version || 'n/a';

  readonly isDevelopment: boolean = process.env.APP_ENV === DEVELOPMENT_ENV;
  readonly isProduction: boolean = process.env.APP_ENV === PRODUCTION_ENV;
  readonly isStage: boolean = process.env.APP_ENV === STAGE_ENV;
  readonly isTest: boolean = process.env.APP_ENV === TEST_ENV;

  readonly [DEVICE_META]: DeviceMeta = {
    version: process.env.DEVICE_VERSION || '',
    firmwareStatus: process.env.DEVICE_FIRMWARE_STATUS || '',
    productLine: process.env.DEVICE_PRODUCT_LINE || '',
    shortname: process.env.DEVICE_SHORTNAME || '',
    model: process.env.DEVICE_MODEL || '',
    name: process.env.DEVICE_NAME || '',
    isManaged: process.env.DEVICE_IS_MANAGED === 'true',
    adoptionTime: process.env.DEVICE_ADOPTION_TIME || '',
  };
  readonly apiVersion = '1';
  readonly [CONTAINER_NAME] = process.env.CONTAINER_NAME;

  readonly httpPort: number = Number(process.env.PORT) || 3000;
  readonly grpcPort: number = Number(process.env.GRPC_PORT) || 50051;
}

export const configInstance = (): Config => new Config();
