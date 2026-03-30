/**
 * Audit logging middleware
 * Records every state-changing (write) request to the console.
 * Only fires for POST, PUT, PATCH and DELETE — read-only GET requests are not logged
 * since they don't modify data and would flood the audit trail.
 *
 * Each audit entry captures:
 *   - timestamp (ISO 8601)
 *   - user ID and role (from req.user, populated by authMiddleware)
 *   - HTTP method and URL path
 *   - client IP address
 *
 * In a production system this would also persist entries to a dedicated
 * AuditLog MongoDB collection for compliance reporting.
 */

/**
 * audit — Express middleware that logs write operations.
 * Must be placed after `protect` middleware so req.user is already available.
 */
export const audit = (req, res, next) => {
  const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (writeMethods.includes(req.method)) {
    const entry = {
      ts: new Date().toISOString(),
      user: req.user?._id ?? 'anonymous',  // user ID from JWT, or 'anonymous' if somehow unauthenticated
      role: req.user?.role ?? 'none',
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    };
    console.log('[AUDIT]', JSON.stringify(entry));
  }

  // Always call next — audit logging must never block the request
  next();
};
