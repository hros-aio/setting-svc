import { Module } from '@nestjs/common';
import { TenantProvisioningConsumer } from './consumers/tenant-provisioning.consumer';
import { CompanyModule } from '../modules/company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [TenantProvisioningConsumer],
  providers: [],
})
export class KafkaModule {}
