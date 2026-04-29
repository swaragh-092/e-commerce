'use strict';

const AuditService = require('./audit.service');

/**
 * Express middleware factory that auto-logs admin mutations to audit_logs.
 * Wraps res.json so it fires AFTER the controller responds (and only on success).
 *
 * Usage:
 *   router.post('/', authenticate, authorize('admin'), auditLog('Product'), controller.create);
 *
 * @param {string} entity  - The entity name (e.g. 'Product', 'Order', 'Settings')
 */
const auditLog = (entity) => (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (data) => {
    // Only log on successful Admin mutations (2xx)
    // AND only if we haven't already logged for this request (prevents double logging with service-level calls)
    if (res.statusCode < 400 && req.user && !req._auditLogged) {
      const method = req.method.toUpperCase();
      let action;
      if (method === 'POST') action = 'CREATE';
      else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
      else if (method === 'DELETE') action = 'DELETE';
      else action = 'UPDATE'; // fallback for custom verbs

      // Allow controller to set a custom action via req._auditAction (e.g. STATUS_CHANGE)
      if (req._auditAction) action = req._auditAction;

      const entityId = req.params.id || data?.data?.id || data?.data?.order?.id || '';

      AuditService.log({
        userId: req.user.id,
        action,
        entity,
        entityId: String(entityId),
        changes: req._auditChanges || null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      req._auditLogged = true;
    }

    return originalJson(data);
  };

  next();
};

module.exports = { auditLog };
