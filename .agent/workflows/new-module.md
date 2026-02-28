---
description: How to create a new backend module from scratch following the established architecture
---

# Create a New Backend Module

Follow these steps exactly when creating any new module.

## 1. Read the architecture docs first
Read `docs/ARCHITECTURE.md` to find the module specification — model fields, endpoints, edge cases.
Read `docs/DATABASE.md` to find the exact SQL schema.
Read `docs/API.md` to find the endpoint signatures and request/response examples.

## 2. Create the module directory
// turbo
```bash
mkdir -p server/src/modules/<module_name>
```

## 3. Create the Sequelize model file
Create `server/src/modules/<module_name>/<module_name>.model.js`

Rules:
- UUID primary key with `DataTypes.UUIDV4`
- `timestamps: true` and `underscored: true`
- Add `paranoid: true` if soft-delete is needed
- Define `associate()` static method for relationships
- Match the schema from `docs/DATABASE.md` exactly

## 4. Create the migration
// turbo
```bash
cd server && npx sequelize-cli migration:generate --name create-<table_name>
```
Then edit the migration to match the schema from `docs/DATABASE.md`, including CHECK constraints.

## 5. Run the migration
// turbo
```bash
cd server && npx sequelize-cli db:migrate
```

## 6. Create the validation schemas
Create `server/src/modules/<module_name>/<module_name>.validation.js`
- Use Joi for validation
- Create schemas for create, update operations
- Match required/optional fields from `docs/API.md`

## 7. Create the service layer
Create `server/src/modules/<module_name>/<module_name>.service.js`
- ALL business logic goes here
- Use transactions for multi-table operations
- Use `utils/pagination.js` for list endpoints
- Use `utils/slugify.js` for slug generation
- Handle edge cases from `docs/EDGE-CASES.md`

## 8. Create the controller
Create `server/src/modules/<module_name>/<module_name>.controller.js`
- Keep thin — only extract params, call service, return response
- ALWAYS use `success()` and `error()` from `utils/response.js`
- Wrap in try/catch, pass errors to `next()`

## 9. Create the routes
Create `server/src/modules/<module_name>/<module_name>.routes.js`
- Use `authenticate` middleware for protected routes
- Use `authorize('admin', 'super_admin')` for admin-only routes
- Use `validate(schema)` for request validation
- Match endpoint paths from `docs/API.md`

## 10. Register the routes in app.js
Add to `server/src/app.js`:
```javascript
app.use('/api/<module_name>', require('./modules/<module_name>/<module_name>.routes'));
```

## 11. Create seed data (optional)
// turbo
```bash
cd server && npx sequelize-cli seed:generate --name demo-<module_name>
```

## 12. Test the endpoints
// turbo
```bash
cd server && npm run dev
```
Then test each endpoint using curl or the browser.

## 13. Add audit logging (if admin-writable)
Add audit middleware to mutation routes (POST, PUT, DELETE):
```javascript
const { auditLog } = require('../audit/audit.middleware');
router.post('/', authenticate, authorize('admin'), auditLog('ModuleName'), validate(schema), ctrl.create);
```
