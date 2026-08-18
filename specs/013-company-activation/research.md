# Phase 0: Technical Research & Architecture Decisions

## Decision 1: Command & Handler Architecture vs Direct Service Invocation

- **Decision**: Implement `activateCompany` method in `CompanyService` (invoking `CompanySetupQueryService.validateAllStepsCompleted`) and expose via `CompanyController` `POST /companies/:id/activate`.
- **Rationale**: The Setting Service follows standard NestJS service-repository patterns (as established across `CompanyService`, `LocationService`, `DepartmentService`, etc.). Centralizing the activation logic in `CompanyService` with strict transactional boundary using `TransactionService.runInTransaction` satisfies clean architecture principles and keeps consistency with `createCompany`, `updateCompanyInformation`, and `designateDefaultCompany`.
- **Alternatives considered**:
  - Standalone CQRS Command Bus (`@nestjs/cqrs`): Rejected because the rest of `setting-svc` uses dedicated Domain Services (`CompanyService`) wrapped with `TransactionService`. Introducing a CQRS command bus just for activation would create architectural inconsistency.

## Decision 2: Multi-Step Completeness Validation Strategy

- **Decision**: Invoke `CompanySetupQueryService.validateAllStepsCompleted(tenantCodeOrId, companyId)` directly within the activation workflow, verifying live database state in `company_setup_steps`.
- **Rationale**: `CompanySetupQueryService` is already implemented and verified in feature `012-company-setup-tracking`. It checks:
  1. Company exists and belongs to the caller's tenant.
  2. Setup tracking records exist (8 steps total).
  3. Identifies all steps where `status !== 'COMPLETED'`.
  4. Returns `isEligible: boolean` (`totalSteps === 8 && completedSteps === 8`) and `incompleteSteps: SetupStepType[]`.
- **Rejection Exception**: If `isEligible` is false, throw domain exception `CompanyActivationRejectedException` carrying `incompleteSteps` and custom message, mapped to HTTP 422 Unprocessable Entity.

## Decision 3: Atomic State Transition & Outbox Event Emission

- **Decision**: Perform company status update (`status = 'ACTIVE'`, `activatedAt = NOW()`, `activatedBy = userId`) and transactional outbox event creation (`company.activated`) inside `TransactionService.runInTransaction`.
- **Event Schema**:
  - `aggregateType`: `COMPANY` (`'company'`)
  - `eventType`: `COMPANY_ACTIVATED` (`'company.activated'`)
  - `payload`:
    ```json
    {
      "companyId": "uuid",
      "tenantId": "uuid",
      "companyCode": "string",
      "displayName": "string",
      "legalName": "string",
      "status": "ACTIVE",
      "activatedAt": "ISO-8601 timestamp",
      "activatedBy": "uuid",
      "completedStepsCount": 8
    }
    ```
  - `status`: `PENDING`
- **Rationale**: Guarantees zero distributed state inconsistencies; either both the status flip and the Kafka event outbox record commit, or neither does.

## Decision 4: Authorization and RBAC Guard

- **Decision**: Protect `POST /companies/:id/activate` with `@UseGuards(AuthGuard, PermissionGuard)` and `@RequirePermission('company:activate')` (or `@RequirePermission('company:update')` / administrator role check).
- **Rationale**: Meets FR-009 / BR-SET-F004-01 restricting activation strictly to authorized Administrators within the tenant context.
