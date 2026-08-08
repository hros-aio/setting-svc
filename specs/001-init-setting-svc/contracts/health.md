# Health API Contract

## Endpoint: GET /setting-api/health

Returns the operational status of `hrms-setting-service` and its connected infrastructure components.

### Request
- **Method**: `GET`
- **Path**: `/setting-api/health`
- **Headers**: None required (Public / Unauthenticated endpoint)

### Response 200 OK (Healthy)
```json
{
  "status": "ok",
  "timestamp": "2026-08-08T12:45:00.000Z",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    }
  }
}
```

### Response 503 Service Unavailable (Unhealthy Infrastructure)
```json
{
  "status": "error",
  "timestamp": "2026-08-08T12:45:00.000Z",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  },
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "down",
      "message": "Connection timeout"
    }
  }
}
```
