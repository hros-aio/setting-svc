# Coding Conventions

Enterprise HRMS Backend — NestJS / TypeScript

Status: Mandatory for all modules under `src/modules/**` and all shared libraries (`libs-core`, `libs-sql`, `libs-apis`).

Philosophy: this document adapts the [Angular Style Guide](https://angular.dev/style-guide) to NestJS. Angular's core tenets — single responsibility, consistent file structure, one concept per file, dependency injection over static access, clear naming that reveals intent — map directly onto NestJS's module/controller/service/provider architecture. Where Angular talks about components and services, read "controller" and "service"; where it talks about feature modules, read "domain module."

---

## 1. TypeScript Conventions

- `strict: true` in `tsconfig.json` is non-negotiable (`strictNullChecks`, `noImplicitAny`, `strictPropertyInitialization` all on). Libraries and modules inherit the root config; do not relax it locally.
- No `any`. If the shape is genuinely unknown, use `unknown` and narrow it. `any` in a PR is an automatic change-request.
- Explicit return types on every exported function, method, and class member. Inference is fine for private local variables, not for public API surfaces.
- Prefer `readonly` on class properties and DTO fields that are not intended to mutate after construction.
- Prefer `interface` for object shapes that describe data contracts; prefer `type` for unions, intersections, tuples, and mapped/utility types (see §5).
- No non-null assertions (`!`) except in test files or where a preceding guard has already narrowed the type and the compiler cannot infer it — leave a comment explaining why.
- Enums are `enum`, not string-literal unions, when the value set is a stable, named domain concept that will appear in Swagger, TypeORM columns, or DTOs (see naming rules below).
- Avoid `export default`. Named exports only — this keeps refactors and IDE auto-imports predictable, consistent with Angular's guidance against default exports.
- One exported class/interface/enum per file, matching the filename (Angular's "one concept per file" rule).

## 2. Naming Conventions

### 2.1 File naming

Pattern: `<name>.<type>.ts`, kebab-case, singular domain noun.

| Artifact | Pattern | Example |
|---|---|---|
| Module | `<domain>.module.ts` | `employee.module.ts` |
| Controller | `<domain>.controller.ts` | `employee.controller.ts` |
| Service | `<domain>.service.ts` | `employee.service.ts` |
| Repository | `<domain>.repository.ts` | `employee.repository.ts` |
| Entity | `<domain>.entity.ts` | `employee.entity.ts` |
| DTO | `<action>-<domain>.dto.ts` | `create-employee.dto.ts`, `update-employee.dto.ts` |
| Interface | `<name>.interface.ts` | `employee-summary.interface.ts` |
| Enum | `<name>.enum.ts` | `employment-status.enum.ts` |
| Constant | `<domain>.constant.ts` | `employee.constant.ts` |
| Decorator | `<name>.decorator.ts` | `current-user.decorator.ts` |
| Guard | `<name>.guard.ts` | `permission.guard.ts` |
| Interceptor | `<name>.interceptor.ts` | `response.interceptor.ts` |
| Middleware | `<name>.middleware.ts` | `tenant-context.middleware.ts` |
| Exception | `<name>.exception.ts` | `employee-not-found.exception.ts` |
| Event | `<domain>-<past-tense-verb>.event.ts` | `employee-created.event.ts` |
| Kafka consumer | `<topic>.consumer.ts` | `employee-sync.consumer.ts` |
| Kafka producer | `<topic>.producer.ts` | `employee-sync.producer.ts` |
| Validator | `<name>.validator.ts` | `unique-email.validator.ts` |
| Subscriber | `<entity>.subscriber.ts` | `employee.subscriber.ts` |
| Spec (unit) | `<name>.spec.ts` | `employee.service.spec.ts` |
| Spec (e2e) | `<name>.e2e-spec.ts` | `employee.e2e-spec.ts` |

Barrel files: one `index.ts` per module folder re-exporting only what's intended to be public. Do not create index barrels inside `entities/`, `dto/` — import those directly to keep dependency graphs traceable.

### 2.2 Code naming

| Element | Convention | Example |
|---|---|---|
| Class | PascalCase, suffixed by role | `EmployeeService`, `CreateEmployeeDto` |
| Interface | PascalCase, **no `I` prefix** | `EmployeeSummary`, not `IEmployeeSummary` |
| Type alias | PascalCase | `EmployeeId`, `PaginatedResult<T>` |
| Enum | PascalCase name, PascalCase or SCREAMING_SNAKE members (see below) | `EmploymentStatus.Active` |
| Generic type parameter | Single uppercase letter or short PascalCase with `T` prefix for non-trivial generics | `T`, `TEntity`, `TResponse` |
| Function / method | camelCase, verb-first | `calculateLeaveBalance()` |
| Variable | camelCase | `employeeCount` |
| Boolean variable/property | `is`/`has`/`can`/`should` prefix | `isActive`, `hasPermission` |
| Constant (module-level, immutable primitive) | SCREAMING_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| Decorator factory | camelCase, verb or descriptive noun | `@CurrentUser()`, `@Roles()` |
| Injection token | SCREAMING_SNAKE_CASE Symbol | `EMPLOYEE_REPOSITORY` |
| Route path segment | kebab-case | `/leave-requests` |
| Database table/column | snake_case (enforced by TypeORM naming strategy in `libs-sql`) | `employee_id` |

Enum member casing: use PascalCase members for domain enums consumed across the app (`EmploymentStatus.Active`), and always set explicit string values (`Active = 'active'`) so the wire format is stable independent of member name.

Avoid abbreviations except industry-standard ones (`id`, `url`, `dto`, `http`). `emp` for `employee` is banned.

## 3. Angular-Style Guide Adaptations for NestJS

| Angular principle | NestJS equivalent |
|---|---|
| One thing per file | One class/decorator/interface per file (§1) |
| Feature modules encapsulate a domain | One NestJS module per business domain, exposing only what other modules need via `exports` |
| Component does presentation, service does logic | Controller does HTTP transport, service does business logic (see implementation-rules.md) |
| Smart/dumb component split | Service (smart, orchestrates) vs. repository (dumb, only persistence) |
| Use DI, avoid `new` | Never `new EmployeeService()`; always constructor-inject. Same rule for repositories, cache clients, loggers |
| Small, focused, testable units | Functions under ~30 lines; services under ~300 lines — split by responsibility, not file size alone |
| Consistent, predictable naming | Suffix-based file/type naming (§2) applied uniformly across every module |
| Barrel exports for public API | Module `index.ts` re-exports controller-facing contracts only |

## 4. Folder & Module Conventions

- Each domain module is self-contained under `modules/<domain>/` with the subfolders defined in `repository-structure.md`. A module never reaches into another module's internal folders (`entities`, `repositories`) — cross-module access happens through exported services only.
- Shared, domain-agnostic code lives in `libs-core`, `libs-sql`, or `libs-apis`, never duplicated inside a domain module.
- Circular imports between domain modules are forbidden. If domain A needs domain B and vice versa, extract the shared contract into `libs-apis` (common DTO/interface) or introduce an event (§ Kafka).

## 5. Interface vs. Abstract Class vs. Type vs. Class

| Use | When |
|---|---|
| `interface` | Describing the shape of data (DTO contracts, repository contracts, config shapes) that multiple unrelated classes may implement or that crosses module boundaries. Prefer for anything injected by token where only the contract matters. |
| `type` | Unions, intersections, tuples, mapped/conditional types, function signatures, or aliasing a primitive/generic combination (`type EmployeeId = string`). Never use `type` for a plain object shape that `interface` could express — keep that distinction consistent for readability. |
| `abstract class` | Shared **behavior**, not just shape — e.g. `BaseRepository<T>` in `libs-sql` providing concrete pagination/soft-delete methods that subclasses inherit. Use only when you need to ship implementation, default method bodies, or protected state alongside the contract. |
| `class` | Anything instantiated by Nest's DI container (services, controllers, guards, interceptors) or a TypeORM entity. Also used for custom exceptions (extending `HttpException`/`BaseException`). |

Rule of thumb: if it's injected and does work, it's a `class`. If it's a pure contract with no behavior, it's an `interface`. If it's a shared partial implementation, it's an `abstract class`. If it's shaping types at compile time only (no runtime footprint), it's a `type`.

## 6. Coding Style

- **Small functions, single responsibility.** A method does one thing; if a service method needs paragraph-length comments to explain sequential steps, extract those steps into private methods.
- **Dependency injection everywhere.** Constructor injection only. No service locators, no manually resolving providers from a module ref outside of dynamic module factories.
- **Avoid static helpers.** Utility-looking logic that depends on config, logging, or DB access must be an injectable provider, not a static class method — statics break testability and hide dependencies. Pure, stateless functions (e.g. date formatting) may live in `libs-core/utilities` as plain exported functions, not classes.
- **Composition over inheritance.** Prefer injecting collaborators over subclassing. The one sanctioned inheritance pattern is `BaseEntity`/`BaseRepository` in `libs-sql`, because it's shared infrastructure behavior, not business logic.
- **Immutability by default.** DTOs and value objects use `readonly` fields. Entities mutate only through explicit methods/services, never by reassigning arbitrary properties from a controller.

```typescript
// Good
@Injectable()
export class LeaveBalanceCalculator {
  calculate(entitlement: number, taken: number): number {
    return Math.max(entitlement - taken, 0);
  }
}

// Avoid
export class DateUtil {
  static calculate(entitlement: number, taken: number): number {
    return Math.max(entitlement - taken, 0);
  }
}
```

## 7. Code Organization Within a File

Standard order inside a class:

1. Static readonly fields (rare — config-like constants only)
2. Instance fields (injected dependencies first, `private readonly`)
3. Constructor
4. Public methods (in the order the public API is typically called)
5. Private methods (in the order they're called by the public methods above them)

```typescript
@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly cacheManager: CacheManager,
    private readonly logger: AppLogger,
  ) {}

  async create(dto: CreateEmployeeDto): Promise<EmployeeSummary> {
    this.validateUniqueEmail(dto.email);
    const entity = await this.employeeRepository.create(dto);
    return this.toSummary(entity);
  }

  private validateUniqueEmail(email: string): void {
    /* ... */
  }

  private toSummary(entity: EmployeeEntity): EmployeeSummary {
    /* ... */
  }
}
```

Imports are grouped and ordered: (1) Node/external packages, (2) `libs-*` shared libraries, (3) intra-module relative imports — each group alphabetized, separated by a blank line, enforced by `eslint-plugin-import`.