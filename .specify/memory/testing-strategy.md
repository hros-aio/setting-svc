# Testing Strategy

Enterprise HRMS Backend — NestJS / TypeScript

---

## 1. Testing Pyramid

```
                ▲
               / \
              / E2E\            fewest — full HTTP flow, real-ish infra
             /-------\
            /  Integ. \         moderate — service + real DB/cache
           /-----------\
          /   Unit       \      most — service/repository/controller logic in isolation
         /-----------------\
```

Guideline distribution: roughly 70% unit, 20% integration, 10% E2E. Every PR introducing business logic must add or extend unit tests; integration/E2E tests are added per-endpoint/per-flow, not per-PR.

## 2. Test Types

### 2.1 Unit Test

Scope: a single class in isolation — one service, one repository method's query-building logic, one guard, one pipe, one utility function. All collaborators are mocked.

```typescript
describe('LeaveBalanceCalculator', () => {
  it('should return zero when taken exceeds entitlement', () => {
    const calculator = new LeaveBalanceCalculator();
    expect(calculator.calculate(10, 15)).toBe(0);
  });
});
```

### 2.2 Integration Test

Scope: a module's service wired to a real (test-container) PostgreSQL instance and, where relevant, a real Redis instance — verifying that the service, repository, and TypeORM mapping actually work together. External services (email, third-party APIs) remain mocked.

### 2.3 E2E Test

Scope: a full HTTP request through Nest's application instance (`supertest` against a bootstrapped `INestApplication`) — controller → guard → pipe → service → repository → test database — verifying the real contract a client depends on, including status codes, response envelope shape, and auth enforcement.

### 2.4 Repository Test

Scope: repository methods against a real test database (via Testcontainers), verifying query correctness (filters, joins, pagination, soft-delete exclusion) — not mocked, since the point is to catch SQL/mapping errors that mocks would hide.

### 2.5 Service Test

Scope: business logic with repositories, cache, and other collaborators mocked — the primary layer for verifying business rules (validation, calculation, orchestration, exception paths) cheaply and deterministically.

### 2.6 Controller Test

Scope: request/response mapping, DTO validation triggering, guard/interceptor invocation — service layer mocked, since the controller's contract is transport, not logic (per `implementation-rules.md`).

## 3. Mocking Strategy

| Layer under test | Mock | Do not mock |
|---|---|---|
| Service (unit) | Repository, cache manager, logger, external HTTP clients, event bus | Pure value objects/DTOs, in-memory calculation logic |
| Controller (unit) | Service | Guards/pipes when testing that they fire correctly (use real ones with a mocked service) |
| Repository (integration) | Nothing — use a real test database | TypeORM itself |
| E2E | External third-party integrations only (payment gateway, email provider, SSO provider) | Internal services, guards, pipes, interceptors, the database |

General rule: **mock at architectural boundaries, not within a layer.** Never mock a private method of the class under test; if you feel the need to, the method should be extracted and tested directly, or the design reconsidered.

Use Nest's `Test.createTestingModule()` with `.overrideProvider()` for service/controller unit tests rather than manually constructing classes, so the DI graph (and any interceptors/pipes attached via metadata) stays representative.

## 4. Database Testing

- Integration and repository tests run against a real PostgreSQL instance via **Testcontainers**, spun up per test suite (not per test) and torn down after, with migrations applied fresh each run — no reliance on a shared, stateful dev database.
- Each test wraps its assertions in a transaction that's rolled back afterward (or truncates affected tables in `afterEach`), so tests remain independent and order-agnostic.
- Seed data is created via factory functions (`libs-sql`-adjacent test utilities), not hand-written SQL fixtures, so seed shape stays in sync with entity definitions.

## 5. Redis Testing

- Unit tests mock `CacheManager` entirely (in-memory fake or jest mock) — no real Redis dependency for pure service logic tests.
- Integration tests that specifically verify caching behavior (TTL, invalidation on write) run against a real Redis instance (Testcontainers or a dedicated test Redis service in CI), asserting actual key presence/absence and TTL rather than only mock call counts.

## 6. Coverage Requirements

Enforced in CI; a PR that drops coverage below these thresholds fails the pipeline.

| Metric | Minimum |
|---|---|
| Statements | 90% |
| Branches | 85% |
| Functions | 90% |

Coverage thresholds apply per-package (`apps/api`, `libs-core`, `libs-sql`, `libs-apis`) so a well-tested library can't mask an undertested domain module, and vice versa. Generated files (migrations, DTOs with no logic beyond decorators) are excluded from the coverage denominator via `collectCoverageFrom` exclusions — coverage percentage should reflect meaningful logic, not decorator boilerplate.

## 7. Testing Principles

### AAA Pattern

Every test follows **Arrange → Act → Assert**, visually separated (blank line or comment) so intent is scannable:

```typescript
it('should throw when email already exists', async () => {
  // Arrange
  repositoryMock.findByEmail.mockResolvedValue(existingEmployee);

  // Act
  const act = () => service.create(createEmployeeDto);

  // Assert
  await expect(act()).rejects.toThrow(EmployeeAlreadyExistsException);
});
```

### Naming Conventions

- Test file: `<name>.spec.ts` (unit/integration), `<name>.e2e-spec.ts` (E2E), colocated next to the file under test for unit tests, under `test/` for E2E.
- `describe` block: the class or unit under test (`EmployeeService`).
- Nested `describe` (optional): the method under test (`create()`).
- `it`/`test` description: behavior-focused, `should <expected behavior> when <condition>` — not implementation-focused (`should call repository.save` is weaker than `should persist the employee with a normalized email`).

### Mock Guidelines Recap

- Prefer Nest's `Test.createTestingModule` + `overrideProvider` over manual instantiation.
- Reset mocks between tests (`jest.clearAllMocks()` in `afterEach`) — no shared mutable mock state across test cases.
- Assert on outcomes (return value, thrown exception, persisted state) over internal call mechanics where both are possible; call-count/argument assertions are appropriate specifically for verifying integration contracts (e.g. "cache was invalidated with the right key").

## 8. Performance Testing Recommendations

- Load test critical, high-traffic endpoints (authentication, employee list/search, attendance check-in) with k6 or Artillery against a staging environment sized like production, before major releases.
- Track p95/p99 latency and error rate under sustained load, not just average response time.
- Include a database-under-load scenario (concurrent writes to the same payroll run/leave balance) to validate optimistic locking behavior under contention, not just correctness in isolation.
- Re-run baseline performance tests after any change to indexing, caching strategy, or the pagination implementation in `libs-sql`, since these are the areas most likely to silently regress at scale.