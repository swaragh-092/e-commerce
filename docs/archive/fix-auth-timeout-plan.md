# Fix Auth Timeout — Root Cause & Plan

## Root Cause

**Silently-dropped PostgreSQL connections from pool with no keepalive/validation.**

PostgreSQL connections sit idle in the pool for 15+ minutes (between login and access token expiry). During idle, firewalls/NAT/load balancers silently drop the TCP connection. Sequelize has no `dialectOptions.keepalive`, no `pool.validate`, and no `statement_timeout`. When a dead connection is handed out from the pool, the query hangs until TCP timeout — and the connection never returns to the pool. After enough zombie connections accumulate, the pool exhausts completely (even production's 20 max connections). Every subsequent login/refresh hangs waiting for a connection, then fails with `ConnectionAcquireTimeoutError`.

## Changes

### 1. `server/src/config/database.js` — Add keepalive, validation, statement_timeout, and dev pool
```js
development: {
    // ...existing...
    pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 10000,
        evict: 10000,
        validate: (client) => {
            return client.query('SELECT 1').then(() => true).catch(() => false);
        },
    },
    dialectOptions: {
        statement_timeout: 30000,         // 30s — kill hanging queries
        idle_in_transaction_session_timeout: 30000,  // 30s — kill stuck transactions
        keepalive: true,
        keepaliveInitialDelayMillis: 10000,
    },
},
production: {
    // ...existing pool max/min...
    pool: {
        max: 20,
        min: 5,
        acquire: 30000,  // 30s (was 60s — fail faster)
        idle: 10000,
        evict: 10000,
        validate: (client) => {
            return client.query('SELECT 1').then(() => true).catch(() => false);
        },
    },
    dialectOptions: {
        statement_timeout: 30000,
        idle_in_transaction_session_timeout: 30000,
        keepalive: true,
        keepaliveInitialDelayMillis: 10000,
    },
},
```

### 2. `server/src/modules/audit/audit.service.js` — Honor transaction parameter
`AuditService.log()` currently ignores the transaction and opens a separate connection. This wastes connections during `refresh()`. Change to use the provided transaction when available.

### 3. `server/src/modules/auth/auth.service.js` — Cache `isEmailVerificationRequired()`
This function hits the settings table on every login and refresh. Cache for 5 seconds.

### 4. `server/src/middleware/errorHandler.middleware.js` — Handle connection timeout errors
Return 503 with clear message instead of generic 500.

### 5. `server/index.js` — Log pool stats on startup

## Files to Modify
| File | Change |
|------|--------|
| `server/src/config/database.js` | keepalive, validate, statement_timeout, dev pool |
| `server/src/modules/audit/audit.service.js` | Honor transaction parameter |
| `server/src/modules/auth/auth.service.js` | Cache isEmailVerificationRequired |
| `server/src/middleware/errorHandler.middleware.js` | Handle connection timeout errors |
| `server/index.js` | Pool monitoring log |
