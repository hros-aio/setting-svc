import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { TenantRepository } from './repositories/tenant.repository';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  providers: [TenantRepository],
  exports: [TenantRepository, TypeOrmModule],
})
export class TenantModule {}
