import { Module } from '@nestjs/common';
import { ApisModule } from '@new-hros/libs-apis';
import {
  CacheModule,
  CacheModuleOptions,
  ConfigurationModule,
  ConfigurationService,
  CoreModule,
  SqlModuleOptions,
} from '@new-hros/libs-core';
import { SqlModule } from '@new-hros/libs-sql';

import { EventsModule, SubscriberModule } from '@new-hros/libs-events';
import { Handlers } from './handlers';
import { CompanyModule } from './modules/company';
import { DepartmentModule } from './modules/department';
import { EffectiveChangeModule } from './modules/effective-change';
import { EmployeeReferenceModule } from './modules/employee-reference';
import { EmployeeTransferModule } from './modules/employee-transfer';
import { GradeModule } from './modules/grade';
import { HealthModule } from './modules/health';
import { JobTitleModule } from './modules/job-title';
import { LocationModule } from './modules/location';
import { OutboxEventsModule } from './modules/outbox-events';
import { PocModule } from './modules/poc';
import { TenantModule } from './modules/tenant';

@Module({
  imports: [
    ConfigurationModule.register({ configDir: 'config', envPath: '.env' }),
    CoreModule.forRoot(),
    CacheModule.registerAsync({
      inject: [ConfigurationService],
      useFactory: (configService: ConfigurationService): CacheModuleOptions => {
        return {
          redis: {
            host: configService.get<string>('redis.host') ?? 'localhost',
            port: configService.get<number>('redis.port') ?? 6379,
          },
        };
      },
    }),
    ApisModule.forRootAsync({
      imports: [CacheModule],
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
    EventsModule,
    SubscriberModule.register(Handlers),
    HealthModule,
    TenantModule,
    CompanyModule,
    LocationModule,
    DepartmentModule,
    GradeModule,
    JobTitleModule,
    EffectiveChangeModule,
    EmployeeReferenceModule,
    OutboxEventsModule,
    PocModule,
    EmployeeTransferModule,
  ],
})
export class AppModule {}
