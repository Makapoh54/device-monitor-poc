// Common
export const APP_RELEASE = 'APP_RELEASE';
export const NODE_ENV = 'NODE_ENV';
export const EXTERNAL_CALL_MAX_ATTEMPTS = 3;
export const CONTAINER_NAME = 'CONTAINER_NAME';
export const LOGGER_CONTEXT = 'DeviceEmulator';

// Env names
export const PRODUCTION_ENV = 'production';
export const STAGE_ENV = 'staging';
export const DEVELOPMENT_ENV = 'development';
export const TEST_ENV = 'test';

// DB
export const HOST = 'HOST';
export const PORT = 'PORT';

// Device
export const DEVICE_META = 'deviceMeta';

export const API_ROUTES = {
  DEVICE: {
    STATUS: '/device/status',
  },
};

export * from './device';
