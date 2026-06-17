# Admin URL Masking

**Location:** `server/src/app.js` · `client/src/services/adminService.js`  
**Category:** Security — Obscurity Layer  
**Status:** ✅ Implemented

---

## What Is It?

Admin URL Masking is a security-through-obscurity technique that hides the true
path of the admin panel from automated scanners, bots, and attackers.

Instead of exposing the admin API at the well-known path `/api/admin/**`, the
mount point is driven by a secret environment variable. Any request to the old
path returns a `404 Not Found` — identical to any non-existent route — giving
attackers no signal that an admin panel exists at all.

```
Before:  POST /api/admin/dashboard/stats   ← discoverable by any scanner
After:   POST /api/mgmt-xK9mP2/dashboard/stats  ← unknown path, 404 if guessed wrong
```

---

## Why It Matters

| Attack vector | Without masking | With masking |
|---|---|---|
| Automated path scanner (gobuster, dirbuster) | Finds `/api/admin` immediately | Gets 404 on every guess |
| Credential stuffing bots | Know exactly where to POST | No endpoint to target |
| OSINT / source code leak | Path is in public JS bundle | Path is in `.env` (not bundled) |
| Brute-force login | Login endpoint is known | Must first find the path |

This does **not** replace authentication — it adds a lightweight first barrier
before auth is even reached.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  .env (server)                                          │
│  ADMIN_ROUTE_PREFIX=/api/mgmt-xK9mP2qL                 │
└────────────────────────┬────────────────────────────────┘
                         │ read at startup
                         ▼
┌─────────────────────────────────────────────────────────┐
│  server/src/app.js                                      │
│                                                         │
│  const adminPrefix =                                    │
│    process.env.ADMIN_ROUTE_PREFIX || '/api/admin';      │
│                                                         │
│  app.use(adminPrefix, adminRoutes);  ◄── mounted here   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  client/.env                                            │
│  VITE_ADMIN_ROUTE_PREFIX=mgmt-xK9mP2qL                 │
└────────────────────────┬────────────────────────────────┘
                         │ baked in at build time (Vite)
                         ▼
┌─────────────────────────────────────────────────────────┐
│  client/src/services/adminService.js                    │
│                                                         │
│  const A =                                              │
│    import.meta.env.VITE_ADMIN_ROUTE_PREFIX || 'admin';  │
│                                                         │
│  api.get(`/${A}/dashboard/stats`)  ◄── all calls here  │
└─────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | What changed |
|---|---|
| `server/src/app.js` | Admin routes mounted at `process.env.ADMIN_ROUTE_PREFIX` instead of the hardcoded `/api/admin` |
| `.env` | Added `ADMIN_ROUTE_PREFIX=/api/admin` (default, safe for local dev) |
| `.env.example` | Documented the variable with examples |
| `client/.env` | Added `VITE_ADMIN_ROUTE_PREFIX=admin` (matches server default) |
| `client/src/services/adminService.js` | All admin API calls use `/${A}/` prefix derived from `import.meta.env.VITE_ADMIN_ROUTE_PREFIX` |

---

## Configuration

### Development (default — no change needed)

```bash
# .env (root)
ADMIN_ROUTE_PREFIX=/api/admin

# client/.env
VITE_ADMIN_ROUTE_PREFIX=admin
```

Both values produce the familiar `/api/admin/**` paths in development.
No friction for local work.

### Production (activate masking)

**Step 1 — Generate a secret slug:**

```bash
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
# e.g. → a3f9c012e7b84d56
```

**Step 2 — Set the server env:**

```bash
# .env (production server)
ADMIN_ROUTE_PREFIX=/api/a3f9c012e7b84d56
```

**Step 3 — Set the client env (must match, without `/api/`):**

```bash
# client/.env (production build)
VITE_ADMIN_ROUTE_PREFIX=a3f9c012e7b84d56
```

**Step 4 — Rebuild the client:**

```bash
npm run build   # Vite bakes the prefix into the bundle at build time
```

> ⚠️ **Both values must stay in sync.** A mismatch causes all admin API calls
> to return 404 even for legitimate admins.

---

## Security Considerations

### What this protects against
- Automated path enumeration (gobuster, ffuf, dirbuster)
- Opportunistic bots targeting the well-known `/api/admin` path
- Casual attackers who haven't obtained source code

### What this does NOT protect against
- An attacker who has read the client `.env` or the server `.env`
- An attacker who has decompiled the production JS bundle
  *(the prefix is baked in at build time — treat the slug like a secret)*
- A compromised admin account — authentication is still required on every
  request regardless of path

### Defence-in-depth order

```
1. URL masking          ← this feature (obscurity layer)
2. Rate limiting        ← loginLimiter on /auth/login (already in place)
3. JWT authentication   ← authenticate middleware (already in place)
4. Role/permission      ← authorizePermissions middleware (already in place)
5. Audit logging        ← every admin action is logged (already in place)
```

### Secret rotation

If the slug leaks, rotate it immediately:

1. Generate a new slug (`node -e "..."` above)
2. Update `ADMIN_ROUTE_PREFIX` on the server
3. Update `VITE_ADMIN_ROUTE_PREFIX` in the client env
4. Rebuild and redeploy the client
5. The old path returns `404` immediately after server restart — no migration needed

---

## Deployment Checklist

- [ ] `ADMIN_ROUTE_PREFIX` set to a random slug in the production `.env`
- [ ] `VITE_ADMIN_ROUTE_PREFIX` set to the matching slug (no `/api/` prefix) in `client/.env`
- [ ] Client rebuilt after setting the env variable (`npm run build`)
- [ ] Old `/api/admin` path confirmed to return `404` after deployment
- [ ] Slug stored in your secrets manager (not just in the `.env` file on disk)

---

## Extending This Feature

The following options can be stacked on top for stronger protection:

### Option 2 — Role check at auth layer
Reject non-staff accounts at the auth endpoint itself, independent of path.
Even if someone finds the masked URL, a customer token cannot call any route.

### Option 3 — IP allow-list middleware
Return a fake `404` to any IP not in `ADMIN_ALLOWED_IPS`:

```js
// middleware/adminGuard.middleware.js
const ALLOWED_IPS = (process.env.ADMIN_ALLOWED_IPS || '').split(',').filter(Boolean);

const adminIpGuard = (req, res, next) => {
  if (ALLOWED_IPS.length && !ALLOWED_IPS.includes(req.ip)) {
    return res.status(404).json({ message: 'Not found' }); // lie — don't say 403
  }
  next();
};
```

Apply before `adminRoutes`:

```js
app.use(adminPrefix, adminIpGuard, adminRoutes);
```

### Option 4 — `X-Admin-Key` header check
A static secret header the admin frontend sends on every request.
Acts as a cheap application-level second factor.

```js
// .env
ADMIN_HEADER_SECRET=some-random-value

// middleware
const adminHeaderGuard = (req, res, next) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_HEADER_SECRET) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
};
```

---

## Related Files

- `server/src/app.js` — route mounting
- `client/src/services/adminService.js` — all admin API calls
- `server/src/modules/admin/admin.routes.js` — admin route definitions
- `.env.example` — environment variable reference
- `ARCHITECTURE.md` — overall system architecture
