import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SqlModule } from '@new-hros/libs-sql';
import { LocationEntity } from './entities/location.entity';
import { LocationRepository } from './repositories/location.repository';
import { LocationService } from './services/location.service';
import { LocationController } from './controllers/location.controller';
import { CompanyModule } from '../company/company.module';
import { EffectiveChangeEntity } from '../effective-change/entities/effective-change.entity';
import { OutboxEventEntity } from '../company/entities/outbox-event.entity';
import { EffectiveChangeModule } from '../effective-change/effective-change.module';
import { EffectiveChangeRepository } from '../effective-change/repositories/effective-change.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationEntity, EffectiveChangeEntity, OutboxEventEntity]),
    SqlModule,
    CompanyModule,
    EffectiveChangeModule,
  ],
  controllers: [LocationController],
  providers: [LocationRepository, EffectiveChangeRepository, LocationService],
  exports: [LocationRepository, LocationService],
})
export class LocationModule {}
