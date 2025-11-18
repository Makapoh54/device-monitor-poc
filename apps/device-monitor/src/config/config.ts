import {
  DEVELOPMENT_ENV,
  POSTGRES_CONFIG,
  PRODUCTION_ENV,
  STAGE_ENV,
  TEST_ENV,
} from './consts';

export type PostgresConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export class Config {
  readonly version: string = process.env.npm_package_version || 'n/a';

  readonly isDevelopment: boolean = process.env.APP_ENV === DEVELOPMENT_ENV;
  readonly isProduction: boolean = process.env.APP_ENV === PRODUCTION_ENV;
  readonly isStage: boolean = process.env.APP_ENV === STAGE_ENV;
  readonly isTest: boolean = process.env.APP_ENV === TEST_ENV;

  readonly httpPort: number = Number(process.env.PORT) || 3000;

  readonly [POSTGRES_CONFIG]: PostgresConfig = {
    host: process.env.MONITOR_DB_HOST || 'monitor-db',
    port: Number(process.env.MONITOR_DB_PORT) || 5432,
    username: process.env.MONITOR_DB_USER || 'monitor',
    password: process.env.MONITOR_DB_PASSWORD || 'monitor',
    database: process.env.MONITOR_DB_NAME || 'device_monitor',
  };
  readonly apiVersion = '1';
}

export const configInstance = (): Config => new Config();
