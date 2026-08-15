import { Module } from '@nestjs/common';
import { TenantProvisioningConsumer } from './consumers/tenant-provisioning.consumer';
import { RoleCopyCompletedConsumer } from './consumers/role-copy-completed.consumer';
import { CompanyModule } from '../modules/company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [TenantProvisioningConsumer, RoleCopyCompletedConsumer],
  providers: [],
})
export class KafkaModule {}
