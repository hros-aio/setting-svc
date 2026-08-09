# Product Requirements Document: HRMS Setting Module

**Document Owner:** Product Management
**Module:** Setting Module (Organizational Foundation Configuration)
**Status:** Approved
**Approval Date:** August 8, 2026
**Audience:** Product, Engineering, QA, Business Stakeholders

---

## 1. Objective

The Setting Module establishes the organizational foundation required for a tenant — and each Company within that tenant — to operate within the HRMS platform. It enables administrators to define and maintain the core organizational structure (Company, Location, Department, Grade, Job Title, and Organization Responsibilities), to initialize new Companies efficiently using existing configuration, to govern the movement of employees between Companies, and to control the sequence of activities that must occur before a Company is considered operationally ready.

The objective of this module is to ensure that every Company begins its HRMS lifecycle with a complete, accurate, and validated organizational structure; that organizational changes are governed, predictable, and auditable over time; and that multi-company tenants can scale their organizational setup without compromising the independence and integrity of each Company's configuration.

This PRD defines **what** the Setting Module must do and **why**, from a business perspective. It intentionally excludes technical implementation details such as database design, API contracts, event models, schedulers, or system architecture.

---

## 2. Business Context

Enterprise HRMS platforms (e.g., Workday, SAP SuccessFactors, Oracle HCM) require a well-defined organizational backbone before any workforce data can be meaningfully managed. Without a validated structure of locations, departments, grades, job titles, and accountable owners, downstream processes such as onboarding, compensation management, approvals, and reporting cannot function reliably.

Large enterprises frequently operate as multi-company organizations — a single Tenant may encompass several legally distinct Companies, such as regional subsidiaries or business units. Each of these Companies requires its own organizational structure, yet often shares common conventions (grading structures, standard job titles, common roles) with a "template" Company. Manually rebuilding this structure for every new Company is inefficient and error-prone.

The Setting Module addresses these needs by:

- Automatically initializing a Company when a tenant is provisioned, and supporting the creation of additional Companies thereafter.
- Allowing new Companies to initialize their configuration by copying selected data from a Default Company, without creating an ongoing dependency between them.
- Ensuring that no Company can begin operational HR activity prematurely, through a mandatory, trackable setup process.
- Ensuring organizational master data changes are governed and auditable over time, rather than applied carelessly or retroactively.
- Making organizational accountability explicit through Organization Responsibilities (Points of Contact).
- Supporting the controlled, auditable transfer of employees between Companies as a distinct business process.

This module is foundational: nearly every other module in the platform (Employee Management, Payroll, Roles & Permissions, Reporting) depends on the structures configured here.

---

## 3. Scope

### 3.1 In Scope

- Automatic initialization of a Company upon successful tenant provisioning, and creation of additional Companies within a tenant thereafter.
- Completion and maintenance of Company information by administrators.
- Designation of a Default Company within a tenant, and initialization of new Companies by copying configuration from the Default Company.
- Management (create, update, deactivate) of company-owned organizational master data: Location, Department, Grade, Job Title, and Organization Responsibilities.
- Effective-dated changes for all organizational master data, preserving historical integrity.
- Definition and enforcement of the mandatory Company setup sequence.
- Tracking and surfacing of setup progress (completed vs. incomplete steps) per Company.
- Explicit, administrator-initiated Company activation, subject to completion validation.
- Configuration of Organization Responsibilities (Point of Contact) as a distinct business concept.
- Governance of Company status transitions (PENDING → ACTIVE).
- Multi-company principles, including configuration ownership and isolation between Companies.
- The business process for transferring an employee from one Company to another within the same tenant.

### 3.2 Out of Scope

- Detailed design of Role definitions and permission structures (referenced as a setup step and as copyable configuration, but role design itself is governed by a separate module).
- Detailed mechanics of employee data import (referenced as a setup step, but governed by a separate module).
- Payroll configuration and processing.
- Any technical implementation detail, including but not limited to: system architecture, database schema, APIs, integration events, background processing, or scheduling mechanisms.
- Company deactivation or deprovisioning after activation.
- Cross-tenant operations (all multi-company behavior described in this PRD occurs within a single tenant).
- Detailed compensation, benefits, or organizational chart/reporting-line management.

---

## 4. Actors

| Actor | Description |
|---|---|
| **Tenant** | The top-level customer organization subscribed to the HRMS platform. May contain one or more Companies. |
| **Company** | A legally distinct business entity within a Tenant, owning its own organizational master data and employees. |
| **Administrator** | A user with authority to configure Company information and organizational master data, including creating new Companies and initiating employee transfers. |
| **HR Business User** | A user who consumes organizational master data (e.g., Location, Department) in downstream HR processes, once a Company is active. |
| **System** | The HRMS platform itself, responsible for enforcing setup sequencing, effective-dating rules, configuration copy behavior, and activation eligibility. |
| **Point of Contact (PoC)** | An individual assigned organizational responsibility (e.g., HR Head, Finance Head) within a Company. Not a system actor in the technical sense, but a business role referenced by the module. |
| **Employee** | A member of the workforce belonging to a Company, who may be the subject of an inter-company transfer. |

---

## 5. Functional Requirements

### 5.1 Company Initialization and Creation

- FR-1: The system MUST automatically create exactly one Company immediately upon successful provisioning of a new tenant.
- FR-2: Every Company MUST belong exclusively to one Tenant.
- FR-3: The system MUST initialize a Company's legal entity information from the data captured during tenant registration, where applicable.
- FR-4: The system MUST set the status of every newly created Company to **PENDING**.
- FR-5: Administrators MUST be able to complete and update the remaining HRMS-specific Company information through the Setting Module.
- FR-6: The system MUST allow Administrators to create additional Companies within a Tenant after the initial Company has been provisioned.

### 5.2 Default Company and Configuration Initialization

- FR-7: The system MUST allow a Tenant to designate exactly one Company as the **Default Company**.
- FR-8: When creating a new Company, the system MUST allow Administrators to optionally initialize its configuration by copying selected configuration from the Default Company.
- FR-9: Copyable configuration MUST include, at minimum: Grades, Job Titles, Roles, and Organization Responsibilities.
- FR-10: The system MUST allow Administrators to select which categories of configuration to copy; copying MUST NOT be all-or-nothing.
- FR-11: Once copied, configuration MUST become independently owned and editable by the receiving Company.

### 5.3 Organizational Master Data Management

- FR-12: The system MUST allow Administrators to create, update, and deactivate Location, Department, Grade, and Job Title records, each scoped to a single Company.
- FR-13: The system MUST require an Effective Date for every create, update, and deactivate operation performed on organizational master data.
- FR-14: The system MUST preserve the historical state of organizational master data; changes MUST NOT overwrite or erase prior active states.
- FR-15: The system MUST present, at any point in time, the correct active version of a master data record based on the current date relative to configured effective dates.

### 5.4 Mandatory Company Setup Sequence

- FR-16: The system MUST define a mandatory setup sequence for each Company, consisting of the following steps:
  1. Complete Company Information
  2. Configure Locations
  3. Configure Departments
  4. Configure Grades
  5. Configure Job Titles
  6. Configure Roles
  7. Import Employees
  8. Configure Organization Responsibilities (Point of Contact)
- FR-17: The system MUST track the completion state of each setup step independently, per Company.
- FR-18: The system MUST allow Administrators to view which setup steps are complete and which remain incomplete, for any given Company, at any time.
- FR-19: Where configuration for a step has been successfully copied from the Default Company during creation (e.g., Grades, Job Titles, Roles), the system MAY consider that step's minimum completion criteria satisfied, subject to Business Rules in Section 6.

### 5.5 Company Activation

- FR-20: The system MUST require an explicit business action by an Administrator to activate a Company; activation MUST NOT occur automatically or implicitly.
- FR-21: The system MUST validate that all mandatory setup steps for a Company are complete before permitting its activation.
- FR-22: The system MUST reject an activation request if any mandatory setup step is incomplete, and MUST communicate which steps remain outstanding.
- FR-23: Upon successful activation, the system MUST transition the Company's status from PENDING to **ACTIVE**.

### 5.6 Organization Responsibilities (Point of Contact)

- FR-24: The system MUST allow Administrators to configure Organization Responsibilities, representing individuals accountable for specific organizational functions within a Company (e.g., Country Head, HR Head, Finance Head, IT Head, Payroll Owner).
- FR-25: Organization Responsibilities MUST be modeled as business responsibility assignments and MUST NOT be treated as attributes of Company, Location, Department, Grade, or Job Title.
- FR-26: The system MUST allow Administrators to update Organization Responsibility assignments over time.

### 5.7 Multi-Company Management

- FR-27: The system MUST allow a Tenant to contain one or more Companies.
- FR-28: Each Company MUST own and manage its own Locations, Departments, Grades, Job Titles, Employees, and Organization Responsibilities independently of other Companies.
- FR-29: The system MUST keep organizational master data isolated between Companies, except where explicitly copied during Company creation as described in Section 5.2.

### 5.8 Employee Transfer Between Companies

- FR-30: The system MUST support the transfer of an Employee from one Company to another Company within the same Tenant as a distinct business process, separate from routine employee record edits.
- FR-31: Every inter-company transfer MUST require an Effective Date.
- FR-32: The system MUST keep the Employee's current employment active and attributed to the originating Company until the transfer's effective date is reached.
- FR-33: From the transfer's effective date onward, the system MUST attribute the Employee to the destination Company.
- FR-34: The system MUST preserve historical employment information related to the originating Company for audit purposes after a transfer takes effect.

---

## 6. Business Rules

### 6.1 Company Initialization Rules

- BR-1: Exactly one Company MUST be automatically created at tenant provisioning; this initial Company MUST start in PENDING status.
- BR-2: A Company MUST NOT be created directly in ACTIVE status under any circumstance, regardless of whether it is the initial Company or a subsequently created one.
- BR-3: Legal entity information initialized from tenant registration data MAY be reviewed by Administrators but MUST NOT, by itself, be treated as incomplete for the purpose of activation.

### 6.2 Default Company and Configuration Copy Rules

- BR-4: A Tenant MUST have at most one Company designated as the Default Company at any given time.
- BR-5: Configuration copying from the Default Company MUST occur only once, at the moment of the new Company's creation; it is a point-in-time initialization action, not an ongoing relationship.
- BR-6: Copied configuration MUST become fully and independently owned by the new Company immediately after the copy operation completes.
- BR-7: Subsequent changes made to the Default Company's configuration MUST NOT be automatically propagated to any Company that previously copied from it. This PRD explicitly distinguishes **configuration initialization (copy)** — a one-time duplication of data with no ongoing relationship — from **inheritance** — a persistent, dynamic relationship in which a dependent entity continuously reflects the source entity's current state. The Setting Module implements only configuration initialization (copy); it does not implement inheritance.
- BR-8: A Company that received copied configuration MAY subsequently create, update, or deactivate that configuration independently, following the same rules (including effective-dating) as any other Company.
- BR-9: If an Administrator chooses not to copy a given configuration category during Company creation, that category MUST start empty for the new Company and MUST be configured manually.

### 6.3 Master Data Effective-Dating Rules

- BR-10: The Effective Date (`effectiveAt`) supplied for any create, update, or deactivate operation on organizational master data MUST NOT be earlier than the end of the current business day. Same-day, immediate-effect changes are not permitted.
- BR-11: Prior to the effective date of a scheduled change, the existing (current) version of the record MUST remain the active business state.
- BR-12: From the effective date onward, the scheduled version MUST become the active business state, replacing the previously active version.
- BR-13: A master data record MAY have at most one pending scheduled change awaiting a future effective date at any given time.
- BR-14: Deactivation is subject to the same effective-dating rule as creation and update; a record scheduled for deactivation MUST remain active in the business sense until its effective date is reached.
- BR-15: Historical versions of organizational master data MUST remain retrievable for audit and reporting purposes; no version MUST be permanently deleted as a result of an update.

### 6.4 Setup and Activation Rules

- BR-16: A Company MUST NOT be activated while any of its eight mandatory setup steps is incomplete.
- BR-17: The mandatory setup steps MUST be tracked independently of one another, per Company; completing one step MUST NOT be inferred from the completion of another, except as explicitly permitted by BR-18.
- BR-18: Where configuration such as Grades, Job Titles, or Roles has been copied from the Default Company during creation, the corresponding setup step MAY be considered satisfied without requiring the Administrator to re-enter that configuration manually; however, the Administrator retains the ability to further customize it.
- BR-19: The order in which setup steps are presented to the Administrator SHOULD follow the defined sequence, but the system MAY allow steps to be completed out of order unless a specific dependency requires otherwise.
- BR-20: Once a Company transitions to ACTIVE status, it MUST remain ACTIVE; reversion to PENDING status is out of scope for this module.
- BR-21: An Administrator MUST be able to determine, without ambiguity, the reason activation was rejected (i.e., which step or steps are incomplete).

### 6.5 Organization Responsibility Rules

- BR-22: An Organization Responsibility assignment MUST be associated with a specific organizational function (e.g., HR Head) within a specific Company, not with a Location, Department, Grade, or Job Title record.
- BR-23: The system MAY allow multiple Organization Responsibilities to exist for different functions within the same Company simultaneously.
- BR-24: A single individual MAY be assigned to more than one Organization Responsibility, including across different Companies within the same Tenant.

### 6.6 Multi-Company Isolation Rules

- BR-25: Organizational master data (Location, Department, Grade, Job Title, Organization Responsibilities) MUST be scoped exclusively to the Company that owns it.
- BR-26: A Company MUST NOT read, modify, or be affected by another Company's organizational master data, except through the one-time configuration copy described in Section 6.2.
- BR-27: Employees MUST belong to exactly one Company at any given point in time, except during the transitional period governed by an in-progress transfer (see Section 6.7).

### 6.7 Employee Transfer Rules

- BR-28: An inter-company transfer MUST specify an Effective Date, which MUST NOT be earlier than the end of the current business day.
- BR-29: Prior to the transfer's effective date, the Employee MUST remain attributed to, and MUST continue their employment under, the originating Company.
- BR-30: From the transfer's effective date onward, the Employee MUST be attributed to the destination Company.
- BR-31: A transfer MUST NOT be treated as a termination and re-hire; it MUST be modeled as a continuous employment relationship transitioning between Companies.
- BR-32: Historical employment records pertaining to the Employee's tenure at the originating Company MUST remain accessible for audit purposes after the transfer takes effect.
- BR-33: An Employee MAY have at most one pending, unexecuted transfer scheduled at any given time.

---

## 7. User Stories

### 7.1 Company Initialization and Creation

**US-1:** As a new Tenant, I want a Company record to be automatically created when my organization is provisioned, so that I can begin configuring my organization without manual setup steps.

**US-2:** As an Administrator, I want the Company's legal information to be pre-filled from our tenant registration, so that I do not have to re-enter information we already provided.

**US-3:** As an Administrator, I want to create additional Companies within our Tenant, so that I can represent our various legal subsidiaries or business units in the platform.

### 7.2 Default Company and Configuration Initialization

**US-4:** As an Administrator, I want to designate one of our Companies as the Default Company, so that it can serve as a configuration template for new Companies we create.

**US-5:** As an Administrator, I want to copy Grades, Job Titles, Roles, and Organization Responsibilities from our Default Company when creating a new Company, so that I do not have to rebuild common configuration from scratch.

**US-6:** As an Administrator, I want changes I make to a new Company's copied configuration to remain independent of the Default Company, so that customizing one Company's structure does not unintentionally affect another.

**US-7:** As an Administrator, I want to know that future changes to the Default Company will not automatically apply to Companies that already copied from it, so that I can plan configuration updates deliberately for each Company.

### 7.3 Organizational Master Data

**US-8:** As an Administrator, I want to create new Locations, Departments, Grades, and Job Titles for my Company, so that I can reflect our organizational structure in the system.

**US-9:** As an Administrator, I want to schedule a future change to a Department, so that the change takes effect on a specific business-relevant date (e.g., the start of a new fiscal quarter) without disrupting current operations.

**US-10:** As an Administrator, I want to deactivate a Location that is no longer in use, effective from a future date, so that historical records referencing that Location remain intact and accurate.

**US-11:** As an HR Business User, I want to see the currently active version of organizational master data, so that I am not confused by changes that have not yet taken effect.

### 7.4 Setup Progress and Activation

**US-12:** As an Administrator, I want to see which setup steps I have completed and which remain outstanding for each of my Companies, so that I understand what is required before I can activate them.

**US-13:** As an Administrator, I want to attempt to activate a Company and be clearly told which steps are incomplete if activation fails, so that I know exactly what to do next.

**US-14:** As an Administrator, I want to explicitly activate a Company once all setup steps are complete, so that this part of our organization can begin operational use of the platform.

**US-15:** As an Administrator, I want configuration copied from the Default Company to count toward relevant setup steps, so that I am not forced to redundantly re-confirm configuration I have already inherited via copy.

### 7.5 Organization Responsibilities

**US-16:** As an Administrator, I want to designate individuals as Points of Contact for organizational responsibilities such as HR Head or Finance Head within each Company, so that accountability is clear across our organization.

**US-17:** As an Administrator, I want to update a Point of Contact assignment when responsibility changes hands, so that our accountability records remain current.

### 7.6 Employee Transfer

**US-18:** As an Administrator, I want to initiate a transfer of an Employee from one Company to another, so that I can reflect internal organizational moves such as relocations or restructuring.

**US-19:** As an Administrator, I want to specify an Effective Date for an Employee transfer, so that the transfer aligns with real business timing such as payroll cutoffs.

**US-20:** As an HR Business User, I want an Employee's historical employment at their original Company to remain visible after a transfer, so that I can support audits and answer historical questions accurately.

---

## 8. Acceptance Criteria (Given / When / Then)

### 8.1 Company Initialization and Creation

**AC-1**
- **Given** a new tenant has been successfully provisioned
- **When** provisioning completes
- **Then** exactly one Company MUST exist for that tenant, with status PENDING

**AC-2**
- **Given** a Tenant already has one or more Companies
- **When** an Administrator creates a new Company
- **Then** the new Company MUST be created with status PENDING and MUST belong exclusively to that Tenant

### 8.2 Default Company and Configuration Copy

**AC-3**
- **Given** a Tenant has designated a Default Company
- **When** an Administrator creates a new Company and selects Grades and Job Titles to copy
- **Then** the new Company MUST receive independent copies of the Default Company's current Grades and Job Titles, and no other configuration category MUST be copied

**AC-4**
- **Given** a new Company received copied Grades from the Default Company
- **When** the Default Company's Grades are subsequently updated
- **Then** the new Company's previously copied Grades MUST remain unchanged

**AC-5**
- **Given** an Administrator is creating a new Company
- **When** they decline to copy any configuration from the Default Company
- **Then** the new Company's organizational master data MUST start empty and MUST require manual configuration

### 8.3 Organizational Master Data

**AC-6**
- **Given** an Administrator is creating a new Department for a Company
- **When** they submit the creation request without an Effective Date
- **Then** the system MUST reject the request

**AC-7**
- **Given** an Administrator is creating a new Location
- **When** they specify an Effective Date earlier than the end of the current business day
- **Then** the system MUST reject the request

**AC-8**
- **Given** a Department has an active current version and a scheduled future version
- **When** the current date is before the scheduled version's effective date
- **Then** the system MUST present the current version as the active business state

**AC-9**
- **Given** a Department has a scheduled future version
- **When** the current date reaches or passes the scheduled version's effective date
- **Then** the system MUST present the scheduled version as the active business state

**AC-10**
- **Given** a Grade is deactivated with a future effective date
- **When** the current date is before that effective date
- **Then** the Grade MUST remain available and active for business use

### 8.4 Setup Progress and Activation

**AC-11**
- **Given** an Administrator has completed some but not all mandatory setup steps for a Company
- **When** they view the setup progress for that Company
- **Then** the system MUST display each of the eight steps with its individual completion status

**AC-12**
- **Given** one or more mandatory setup steps are incomplete for a Company
- **When** an Administrator attempts to activate that Company
- **Then** the system MUST reject the activation and MUST indicate which step(s) are incomplete

**AC-13**
- **Given** all eight mandatory setup steps are complete for a Company
- **When** an Administrator initiates that Company's activation
- **Then** the system MUST transition the Company's status from PENDING to ACTIVE

**AC-14**
- **Given** a new Company received copied Grades, Job Titles, and Roles from the Default Company during creation
- **When** an Administrator views the setup progress
- **Then** the corresponding setup steps MUST reflect a completed state without requiring further manual entry

### 8.5 Organization Responsibilities

**AC-15**
- **Given** an Administrator is configuring Organization Responsibilities for a Company
- **When** they assign an individual as "HR Head"
- **Then** the system MUST record this as a responsibility assignment scoped to that Company, not as an attribute of any Location, Department, Grade, or Job Title

**AC-16**
- **Given** a Point of Contact assignment already exists for a given responsibility within a Company
- **When** an Administrator assigns a new individual to that same responsibility
- **Then** the system MUST update the assignment to reflect the new individual

### 8.6 Multi-Company Isolation

**AC-17**
- **Given** two Companies exist within the same Tenant
- **When** an Administrator updates a Department for Company A
- **Then** Company B's Departments MUST remain unaffected

### 8.7 Employee Transfer

**AC-18**
- **Given** an Administrator initiates a transfer of an Employee from Company A to Company B with a future Effective Date
- **When** the current date is before the Effective Date
- **Then** the Employee MUST remain attributed to, and actively employed under, Company A

**AC-19**
- **Given** an Employee transfer from Company A to Company B has an Effective Date that has been reached or passed
- **When** the Employee's attribution is evaluated
- **Then** the Employee MUST be attributed to Company B

**AC-20**
- **Given** an Employee has completed a transfer from Company A to Company B
- **When** an Administrator reviews the Employee's historical employment records
- **Then** the records pertaining to Company A MUST remain available for audit purposes

**AC-21**
- **Given** an Administrator attempts to submit an Employee transfer request without an Effective Date
- **When** the request is submitted
- **Then** the system MUST reject the request

---

## 9. Business Constraints

- BC-1: A Tenant MAY contain one or more Companies; each Company MUST be treated as an independent legal entity for HR operations.
- BC-2: All organizational master data changes MUST be governed by effective-dating; immediate, same-day changes are not permitted under any circumstance.
- BC-3: Company activation MUST always be a deliberate, explicit action taken by an Administrator; the system MUST NOT infer readiness and auto-activate a Company.
- BC-4: The eight mandatory setup steps constitute the minimum bar for activation; this list MUST NOT be reduced without formal product review, though it MAY be extended in future releases.
- BC-5: Historical organizational master data and employment records MUST be preserved indefinitely for audit and compliance purposes within the scope of this module.
- BC-6: Organization Responsibilities MUST remain conceptually and structurally independent of Company, Location, Department, Grade, and Job Title records.
- BC-7: Configuration copying from a Default Company MUST be strictly a one-time, point-in-time operation; the platform MUST NOT implement any form of ongoing inheritance between Companies.
- BC-8: Organizational master data MUST remain isolated per Company at all times, except during the explicit, one-time configuration copy performed at Company creation.
- BC-9: Employee transfers between Companies MUST be modeled as a continuous employment transition, never as a termination followed by a new hire.

---

## 10. Success Criteria

- SC-1: 100% of newly provisioned tenants have exactly one automatically created Company in PENDING status, with zero manual intervention required.
- SC-2: 0% of Company activations succeed while any mandatory setup step is incomplete (validated through audit sampling and QA regression testing).
- SC-3: 100% of organizational master data changes are applied strictly in accordance with their configured Effective Date, with no incidents of premature or retroactive application.
- SC-4: 100% of newly created Companies that use configuration copy from a Default Company retain full independence from that Default Company afterward, with zero observed cases of unintended propagation of subsequent Default Company changes.
- SC-5: Administrators can determine current setup completion status and any blocking steps, for any Company, without requiring support or documentation assistance, as measured by a reduction in related support tickets after release.
- SC-6: 100% of historical organizational master data and employment records remain retrievable and auditable following any create, update, deactivate, or transfer operation.
- SC-7: 100% of Organization Responsibilities configured by Administrators are correctly attributed to individuals and independently updatable per Company, with no incidents of incorrect attribution to Company, Location, Department, Grade, or Job Title.
- SC-8: 100% of Employee transfers correctly reflect the originating Company before the effective date and the destination Company from the effective date onward, with zero incidents of employment continuity loss or duplicate active employment.

---

*End of Document*
