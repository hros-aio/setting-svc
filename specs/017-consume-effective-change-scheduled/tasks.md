# Tasks: Consume EFFECTIVE_CHANGE_SCHEDULED & Dispatch EFFECTIVE_CHANGE_EXECUTE

**Input**: Design documents from `/specs/017-consume-effective-change-scheduled/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Unit tests and E2E validation tests are included per Constitution Principle IV.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependencies and module configuration

- [x] T001 Verify `EffectiveChangeModule` imports `OutboxEventEntity` and exports in `src/modules/effective-change/effective-change.module.ts`
- [x] T002 [P] Verify `EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED` and `EffectiveChangeEventType.EFFECTIVE_CHANGE_EXECUTE` enum definitions in `src/enums/event-type.enum.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core DTOs and command interfaces needed across user stories

**⚠️ CRITICAL**: Must complete before user story handlers

- [x] T003 [P] Define `EffectiveScheduledEventPayload` DTO interface with validation rules matching contract in `src/modules/effective-change/dto/effective-scheduled-event.dto.ts`
- [x] T004 [P] Update `src/modules/effective-change/index.ts` to export relevant DTOs and interfaces

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Process Scheduled Effective Changes & Create Execute Outbox Event (Priority: P1) 🎯 MVP

**Goal**: Consume `setting.effective-change.scheduled` events, validate payload, and persist `setting.effective-change.execute` outbox record in status `PENDING`.

**Independent Test**: Send a valid `EFFECTIVE_CHANGE_SCHEDULED` event payload to the handler and assert that a new `OutboxEventEntity` row with event type `setting.effective-change.execute` and status `PENDING` is created in PostgreSQL.

### Tests for User Story 1

- [x] T005 [P] [US1] Unit test for scheduled event handling in `src/modules/effective-change/consumers/effective-change.consumer.spec.ts`
- [x] T006 [P] [US1] Unit test for outbox record creation in `src/modules/effective-change/services/effective-change.service.spec.ts`

### Implementation for User Story 1

- [x] T007 [US1] Implement `scheduleExecution` method in `src/modules/effective-change/services/effective-change.service.ts` to persist `OutboxEventEntity` with `EFFECTIVE_CHANGE_EXECUTE` within transaction
- [x] T008 [US1] Implement `@EventPattern(EffectiveChangeEventType.EFFECTIVE_CHANGE_SCHEDULED)` in `src/modules/effective-change/consumers/effective-change.consumer.ts` delegating to `EffectiveChangeService.scheduleExecution`
- [x] T009 [US1] Add structured logging for incoming scheduled change and outbox persistence in `src/modules/effective-change/consumers/effective-change.consumer.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Duplicate Event Handling & Idempotency (Priority: P2)

**Goal**: Skip duplicate event processing safely using Redis/L2 cache deduplication.

**Independent Test**: Emit the same scheduled event ID twice; verify that only one outbox record is persisted and the second invocation is safely acknowledged and skipped.

### Tests for User Story 2

- [x] T010 [P] [US2] Unit test verifying deduplication key check (`setting:dedup:${eventId}`) and skip logic in `src/modules/effective-change/consumers/effective-change.consumer.spec.ts`

### Implementation for User Story 2

- [x] T011 [US2] Implement Redis deduplication key checking and 24h caching in `handleEffectiveChangeScheduled` in `src/modules/effective-change/consumers/effective-change.consumer.ts`

**Checkpoint**: User Story 2 ensures idempotent event consumption without redundant outbox entries.

---

## Phase 5: User Story 3 - Malformed & Invalid Payload Handling (Priority: P3)

**Goal**: Validate incoming payload fields and handle invalid or missing data gracefully with structured warnings without crashing the consumer.

**Independent Test**: Send invalid payloads (missing `changeId`, `entityType`, or `tenantId`) and verify that no outbox record is created, no unhandled exceptions are thrown, and structured warning logs are emitted.

### Tests for User Story 3

- [x] T012 [P] [US3] Unit test for missing mandatory fields and malformed payload skipping in `src/modules/effective-change/consumers/effective-change.consumer.spec.ts`

### Implementation for User Story 3

- [x] T013 [US3] Add validation guards for `changeId`, `entityType`, `operation`, `effectiveAt`, `targetCompanyId`, and `tenantId` in `src/modules/effective-change/consumers/effective-change.consumer.ts`

**Checkpoint**: All user stories implemented and resilient against malformed inputs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration verification, linting, and full test suite execution

- [x] T014 [P] Run linter `pnpm lint` and resolve any typing/linting issues across `src/modules/effective-change/`
- [x] T015 Run unit test suite `pnpm test src/modules/effective-change/`
- [x] T016 Run full test verification according to `specs/017-consume-effective-change-scheduled/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - starts immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Stories (Phases 3-5)**: Depend on Foundational phase completion; executed in priority order P1 → P2 → P3
- **Polish (Phase 6)**: Depends on completion of all user story tasks

### User Story Dependencies

- **User Story 1 (P1)**: Core scheduled consumer & outbox persistence logic
- **User Story 2 (P2)**: Integrates deduplication into the US1 consumer handler
- **User Story 3 (P3)**: Adds defensive payload validation guards to the US1 consumer handler

---

## Parallel Execution Examples

### User Story 1 Tests & Service implementation

```bash
# Run US1 tests in parallel
Task: "Unit test for scheduled event handling in src/modules/effective-change/consumers/effective-change.consumer.spec.ts"
Task: "Unit test for outbox record creation in src/modules/effective-change/services/effective-change.service.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational DTOs)
2. Implement Phase 3 (User Story 1 - Consumer & Service Outbox persistence)
3. Validate with unit tests in `effective-change.consumer.spec.ts` and `effective-change.service.spec.ts`

### Incremental Enhancements

1. Add Phase 4 (Deduplication caching)
2. Add Phase 5 (Malformed payload validation guards)
3. Run Phase 6 (Linter & quickstart validation)
