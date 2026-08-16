import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { LocationController } from './controllers/location.controller';
import { LocationEntity } from './entities/location.entity';
import { LocationRepository } from './repositories/location.repository';
import { LocationService } from './services/location.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationEntity]),
    SqlModule,
    CompanyModule,
    EffectiveChangeModule,
  ],
  controllers: [LocationController],
  providers: [LocationRepository, LocationService],
  exports: [LocationRepository],
})
export class LocationModule {}
