import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEventRepository } from './repositories/outbox-event.repository';
import { OutboxEventService } from './services/outbox-event.service';
import { OutboxEventEntity } from '@new-hros/libs-sql';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity])],
  providers: [OutboxEventRepository, OutboxEventService],
  exports: [OutboxEventRepository, OutboxEventService, TypeOrmModule],
})
export class OutboxEventsModule {}
