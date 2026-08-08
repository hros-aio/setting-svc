# Quickstart Validation Guide: Init Setting Service Infrastructure

This guide outlines how to start `hrms-setting-service` and validate its infrastructure setup, global route prefix, and health check.

## Prerequisites
- Node.js (v18+ or v20+)
- pnpm package manager
- PostgreSQL service running locally or in Docker
- Redis service running locally or in Docker

## 1. Environment Setup

Create `.env` file in project root:
```env
PORT=3000
GLOBAL_PREFIX=setting-api
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=hrms_setting
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 2. Installation & Run Commands

```bash
# Install dependencies
pnpm install

# Build the NestJS service
pnpm build

# Start dev mode
pnpm start:dev
```

## 3. Verification Scenarios

### Scenario 1: Health Check Endpoint Verification
Send GET request to verify the route prefix `/setting-api` and health status:

```bash
curl -i http://localhost:3000/setting-api/health
```

**Expected Result**:
- HTTP Status Code: `200 OK`
- JSON payload containing `"status": "ok"` and infrastructure components status.

### Scenario 2: Unprefixed Route Verification (404 Gate)
Send GET request without the prefix:

```bash
curl -i http://localhost:3000/health
```

**Expected Result**:
- HTTP Status Code: `404 Not Found`

### Scenario 3: Graceful Shutdown Test
Press `Ctrl+C` or send `SIGTERM` to the running app process.

**Expected Result**:
- Logs indicate connection pool closed cleanly without throwing unhandled exceptions.

## Artifact References
- [Specification](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/001-init-setting-svc/spec.md)
- [Data Model](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/001-init-setting-svc/data-model.md)
- [Health API Contract](file:///home/ren0503/new-hros/admin-module/setting-svc/specs/001-init-setting-svc/contracts/health.md)
