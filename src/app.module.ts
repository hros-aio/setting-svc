import { Module } from '@nestjs/common';
import { ApisModule } from '@new-hros/libs-apis';
import {
  ConfigurationModule,
  ConfigurationService,
  CoreModule,
  SqlModuleOptions,
} from '@new-hros/libs-core';
import { SqlModule } from '@new-hros/libs-sql';

import { AppLogger } from './common/logger/app-logger.service';
import { HealthModule } from './modules/health';

const config = new ConfigurationService({});

@Module({
  imports: [
    ConfigurationModule.register({ configDir: 'config', envPath: '.env' }),
    CoreModule.forRoot({
      cache: {
        store: 'redis',
        host: config.get<string>('redis.host') ?? 'localhost',
        port: config.get<number>('redis.port') ?? 6379,
      },
    }),
    ApisModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (
        configService: ConfigurationService,
      ): { auth: { publicKey?: string; privateKey?: string } } => ({
        auth: {
          publicKey: configService.get<string>('jwt.publicKey'),
          privateKey: configService.get<string>('jwt.privateKey'),
        },
      }),
    }),
    SqlModule.forRootAsync({
      inject: [ConfigurationService],
      useFactory: (configService: ConfigurationService): SqlModuleOptions => ({
        type: 'postgres' as const,
        host: configService.get<string>('database.host') ?? 'localhost',
        port: configService.get<number>('database.port') ?? 5432,
        username: configService.get<string>('database.username') ?? 'postgres',
        password: configService.get<string>('database.password') ?? 'postgres',
        database: configService.get<string>('database.name') ?? 'hrms_setting',
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
  ],
  providers: [AppLogger],
  exports: [AppLogger],
})
export class AppModule {}
