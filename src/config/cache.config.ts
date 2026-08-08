import { InfrastructureConfig } from './infrastructure.config';

export interface CacheOptions {
  host: string;
  port: number;
  ttl: number;
  namespace: string;
}

export const getCacheConfig = (config: InfrastructureConfig): CacheOptions => ({
  host: config.redisHost,
  port: config.redisPort,
  ttl: 300,
  namespace: 'setting-svc',
});
