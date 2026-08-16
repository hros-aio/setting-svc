import { Module } from '@nestjs/common';
import { TenantProvisioningConsumer } from './consumers/tenant-provisioning.consumer';
import { RoleCopyCompletedConsumer } from './consumers/role-copy-completed.consumer';
import { EmployeeImportCompletedConsumer } from './consumers/employee-import-completed.consumer';
import { CompanyModule } from '../modules/company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [
    TenantProvisioningConsumer,
    RoleCopyCompletedConsumer,
    EmployeeImportCompletedConsumer,
  ],
  providers: [],
})
export class KafkaModule {}
