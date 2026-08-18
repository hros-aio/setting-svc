# Feature Specification: Multi-Company Isolation

**Feature Branch**: `015-multi-company-isolation`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "Backend Task Breakdown: Multi-Company Isolation - Enforce strict data isolation and independent ownership across multiple Companies within the same Tenant. Ensure no create, update, or deactivate operation on one Company's organizational master data (Location, Department, Grade, Job Title, PoC) reads, mutates, or couples with sibling Companies, preventing cross-company collisions and cross-company foreign key linkages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Independent Company Master Data Ownership & Code Reuse (Priority: P1)

As an HR Administrator managing multiple legal entities (companies) within an enterprise tenant, I want each company to independently own and manage its organizational master data (Locations, Departments, Grades, Job Titles, and Points of Contact), so that sibling companies can use their preferred business codes (such as Grade "L3", Department "ENG", or Location "HQ") without naming collisions, cross-company leakage, or state interference.

**Why this priority**: Independent ownership and conflict-free code reuse are the foundational operational requirements of a multi-company enterprise HR platform. Sibling companies operate under different business models and jurisdictions and must not be restricted by sibling company naming conventions.

**Independent Test**: Can be tested by creating master data entities with identical codes (e.g., Grade code `L3`, Department code `ENG`, Location code `HQ`) in Company A and sibling Company B under the same Tenant, verifying that both persist independently, and confirming that creating a duplicate code within the same company is rejected.

**Acceptance Scenarios**:

1. **Given** Company A has a Grade with code `L3`, **When** an Administrator creates a Grade with code `L3` in sibling Company B under the same Tenant, **Then** the system successfully creates and persists the Grade in Company B without conflict.
2. **Given** an existing Grade with code `L3` in Company A, **When** an Administrator attempts to create another Grade with code `L3` in Company A, **Then** the system rejects the creation due to duplicate code within the company.
3. **Given** Company A has a Department with code `ENG` and Location with code `HQ`, **When** an Administrator creates a Department with code `ENG` and Location with code `HQ` in sibling Company B, **Then** both records are created successfully in Company B.
4. **Given** Company A has an active Point of Contact for responsibility `HR_HEAD`, **When** an Administrator assigns an employee as `HR_HEAD` in sibling Company B, **Then** Company B's assignment persists independently without mutating or displacing Company A's `HR_HEAD`.

---

### User Story 2 - Prevention of Cross-Company Relational Bindings (Priority: P1)

As an HR Administrator configuring composite organizational structures, I want the system to strictly validate and prohibit any cross-company relational linkages (such as a Job Title referencing a Department or Grade from a sibling company, or a Department hierarchy referencing a parent Department in another company), so that organizational integrity and legal entity boundaries remain strictly preserved.

**Why this priority**: Cross-company foreign key linkages cause severe data corruption, unauthorized data leakage, and invalid organizational reporting across legal entities. Domain invariants must guarantee relational isolation at all times.

**Independent Test**: Can be tested by attempting to create or update a Job Title in Company A while supplying a `departmentId` or `gradeId` that belongs to sibling Company B, and verifying that the system rejects the operation with a cross-company reference validation error.

**Acceptance Scenarios**:

1. **Given** Department 101 belongs to Company A and Grade 201 belongs to Company B, **When** an Administrator submits a command to create a Job Title in Company A referencing Department 101 and Grade 201, **Then** the system rejects the request with a domain validation error indicating cross-company references are prohibited.
2. **Given** Department 101 and Grade 102 both belong to Company A, **When** an Administrator creates a Job Title in Company A referencing Department 101 and Grade 102, **Then** validation succeeds and the Job Title is created.
3. **Given** Department 101 belongs to Company A and Department 201 belongs to Company B, **When** an Administrator attempts to set Department 201 as the parent department of Department 101, **Then** the system rejects the update.
4. **Given** an employee registered under the tenant, **When** an Administrator assigns the employee to a PoC responsibility in Company A, **Then** the system validates that the employee belongs to the same tenant context before creating the company-scoped assignment.

---

### User Story 3 - Context-Driven Access Control & Request Scoping (Priority: P2)

As a Security and Compliance Officer, I want every incoming request to be intercepted and verified against authenticated tenant and company permissions, so that users cannot inspect, modify, or query master data of companies they are not authorized to access.

**Why this priority**: Multi-tenant and multi-company security guarantees that legal entity separation is enforced at the API and transport boundaries, preventing unauthorized access or enumeration attacks.

**Independent Test**: Can be tested by authenticating a user with permissions restricted to Company A and sending read/write requests targeting Company B's endpoints, verifying that the request is rejected with HTTP 403 Forbidden or HTTP 404 Not Found.

**Acceptance Scenarios**:

1. **Given** an authenticated user whose credentials only permit access to Company A, **When** the user sends a request to create, update, or view resources under `/companies/{companyBId}/*`, **Then** the system immediately rejects the request with HTTP 403 Forbidden.
2. **Given** an authenticated user for Tenant 1, **When** the user attempts to access any resource belonging to Tenant 2, **Then** the system rejects the request at the tenant security boundary.
3. **Given** a valid query executed in Company A's context with an entity ID that exists only in Company B, **When** the query executes, **Then** the repository returns `null` or resource not found, preventing discovery of sibling company resources.

---

### User Story 4 - Isolated Asynchronous Event Processing & Effective Transitions (Priority: P3)

As an HR System Operator, I want asynchronous domain events and effective-dated changes to be partitioned and processed independently by company (`tenantId:companyId`), so that high-volume operations, scheduled transitions, or processing backlogs in one company never block, delay, or affect the asynchronous event streams of sibling companies.

**Why this priority**: Guarantees system resilience and performance isolation. One company scheduling hundreds of organizational changes must not impede timely event delivery or effective-dating executions in other companies.

**Independent Test**: Can be tested by scheduling concurrent effective-dated changes across sibling Company A and Company B, publishing their events to the outbox, and verifying that message partition keys are isolated (`tenantId:companyAId` vs `tenantId:companyBId`) and process concurrently.

**Acceptance Scenarios**:

1. **Given** an effective-dated change or master data update submitted in Company A, **When** the domain event is prepared and written to the transactional outbox, **Then** the message partition key is formatted as `tenantId:companyAId`.
2. **Given** concurrent effective-dated change execution events occurring in Company A and Company B, **When** consumer workers process the events, **Then** Company A's execution stream operates independently and cannot serialize or block Company B's processing stream.
3. **Given** a scheduled execution command dispatched to the Setting Service, **When** the execution runs, **Then** the mutation is strictly bounded to the target company's context without evaluating or locking sibling company records.

---

### Edge Cases

- **Cross-Company Hierarchy Loops**: What happens when an administrator attempts to construct a department hierarchy linking departments across sibling companies? The system validates the `company_id` of parent and child departments on every update, rejecting any cross-company parent-child relationship.
- **Payload and URL Scope Mismatch**: What happens when a request specifies `companyId` in the URL path matching the user's session, but includes a different `companyId` in the JSON request body? The system prioritizes verified context from authentication and path guards, rejecting mismatched body parameters.
- **Concurrent Master Data Creation with Identical Code in Sibling Companies**: What happens when two administrators simultaneously create an identical Grade code (e.g., `L3`) in Company A and Company B? Both operations succeed independently because uniqueness constraints are scoped to `(company_id, code)`.
- **Tenant-Wide Aggregated Read Queries**: What happens when an executive user queries an employee's PoC roles across all companies within a tenant? The system allows tenant-filtered read queries for read-only aggregation views, while ensuring all mutation endpoints remain strictly company-isolated.
- **Effective-Dated Worker Execution Isolation**: What happens if an effective-dated worker task fails during execution in Company A? The failure and retry state remain completely isolated to Company A's outbox and partition stream, with zero impact on Company B's scheduled jobs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce independent data ownership and complete isolation for all organizational master data (Locations, Departments, Grades, Job Titles, and Points of Contact) across distinct companies within the same tenant.
- **FR-002**: System MUST enforce composite uniqueness constraints per company `(company_id, code)` across all organizational master data tables (`locations`, `departments`, `grades`, `job_titles`), permitting identical codes across different companies within the same tenant.
- **FR-003**: System MUST enforce single-responsibility uniqueness per company `(company_id, poc_type)` for Point of Contact records, allowing sibling companies to independently assign identical responsibility types.
- **FR-004**: System MUST validate that all foreign entity references within composite master data mutations (such as Job Title referencing a Department or Grade) belong strictly to the same company (`RequestContext.companyId`) and tenant (`RequestContext.tenantId`).
- **FR-005**: System MUST reject any attempt to link master data entities across different companies or tenants with a cross-company reference validation error.
- **FR-006**: System MUST enforce parent-child department hierarchy references strictly within the same company boundary, prohibiting cross-company parent department assignments.
- **FR-007**: System MUST intercept all HTTP requests to company-scoped endpoints and validate that the caller has authorized access to the targeted `companyId` and `tenantId`.
- **FR-008**: System MUST extract and verify tenant and company identifiers exclusively from verified authentication context and validated routing parameters, refusing to trust unverified payload fields.
- **FR-009**: System MUST bind all repository queries and database mutations with mandatory `tenant_id = :tenantId AND company_id = :companyId` predicates sourced from request context.
- **FR-010**: System MUST format all asynchronous outbox and Kafka domain event partition keys as `tenantId:companyId`, ensuring strict per-company async isolation and partition ordering.
- **FR-011**: System MUST execute effective-dated organizational state transitions and setup step validations strictly within the targeted company's boundary without locking or scanning sibling company tables.
- **FR-012**: System MUST support cross-company read-only aggregations (such as viewing an employee's assigned PoC responsibilities across sibling companies within a tenant) while strictly preserving mutation boundaries per company.

### Key Entities

- **Company**: The legal entity boundary within a tenant. Owns all associated organizational master data and configuration records.
- **Organizational Master Entities**: Entities representing structural building blocks (`Location`, `Department`, `Grade`, `JobTitle`, `PointOfContact`). Each entity strictly encapsulates `tenantId` and `companyId` foreign keys and composite business code uniqueness.
- **Cross-Company Invariant Validator**: Domain validation service responsible for verifying that relational associations (e.g., Job Title → Department, Job Title → Grade, Department → Parent Department) share identical company ownership.
- **Security Scope Context**: Context object encapsulating verified `tenantId`, `companyId`, and authorized permissions extracted from authentication tokens and transport guards.
- **Transactional Outbox Event**: Message envelope containing the domain event payload and serialized partition key (`tenantId:companyId`) for asynchronous event routing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of master data entity types support duplicate business codes across distinct companies within the same tenant without database constraint violations or collisions.
- **SC-002**: 100% of attempted cross-company relational bindings (e.g., Job Title referencing a sibling company's Grade or Department) are intercepted and rejected with zero invalid linkages persisted.
- **SC-003**: 100% of unauthorized cross-company read and write HTTP requests are blocked at the guard layer (returning HTTP 403 Forbidden or HTTP 404 Not Found).
- **SC-004**: 100% of outbox events for company-scoped master data emit Kafka messages with composite partition keys (`tenantId:companyId`), achieving zero cross-company event partition collision.
- **SC-005**: 100% of repository queries for company-scoped entities strictly enforce `tenant_id` and `company_id` filter conditions, eliminating cross-company data leakage.

## Assumptions

- **Tenant and Company Hierarchy**: A tenant represents the highest-level organization boundary and contains one or more distinct companies. All companies under a tenant share tenant-level user identity directory projections, but master data is strictly company-owned.
- **Authentication Claims**: Authentication tokens provide verified `tenantId` and permitted `companyId` scopes evaluated by security guards before request handling.
- **Standalone Master Data**: Master data is not inherited from parent/sibling companies in real-time; template initialization operates strictly on a copy-on-create basis (ADR-11).
- **Relational Integrity Ownership**: The Setting Service is the sole authority for organizational master data and enforces both database-level uniqueness and application-level invariant validation.
- **Partition Key Standard**: The standard partition key format for multi-company messaging in Kafka is `${tenantId}:${companyId}` in compliance with system architecture standards.
