# 0012 — Staff account suspension in Access Control

**Status:** accepted  
**Date:** 2026-10-31  
**Spec:** none

## Context

Administrators can assign and delete staff accounts in Access Control, but cannot temporarily suspend an account there. The existing user status endpoint is protected by customer-management permission and intentionally rejects staff targets. Staff suspension must not bypass that boundary or remove the account's assigned role.

## Decision

Add staff status changes to Access Control behind the existing `users.assign_roles` permission. Require a reason for both suspension and reactivation, write the actor, status transition, and reason to the audit log, and revoke refresh-token sessions when suspending. Keep the existing role assignments so reactivation restores the staff member's previous access. Prevent users from changing their own status, prevent non-superadmins from changing superadmin status, and prevent suspension of the last active superadmin. Customer status management remains on the Customers page.

## Consequences

- Staff managers can pause and restore staff access without deleting accounts or changing their roles.
- Inactive accounts are denied by the existing authentication middleware, and active refresh sessions are revoked at suspension time.
- Status changes have a required, auditable reason.
- Staff status management shares the existing staff-management permission rather than introducing another permission key.

## Alternatives considered

- Reuse the customer status endpoint: rejected because its permission and customer-only target checks would create an unsafe staff-management path.
- Delete staff accounts to remove access: rejected because deletion is permanent and loses role assignment context.
