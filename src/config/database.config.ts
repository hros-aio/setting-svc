import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { InfrastructureConfig } from './infrastructure.config';

export const getDatabaseConfig = (config: InfrastructureConfig): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.dbHost,
  port: config.dbPort,
  username: config.dbUsername,
  password: config.dbPassword,
  database: config.dbName,
  autoLoadEntities: true,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
