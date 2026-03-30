/**
 * RBAC helpers — primary `role` plus optional `secondaryRoles` from the API.
 */

export function userHasRole(user, role) {
  if (!user || !role) return false;
  if (user.role === role) return true;
  return (user.secondaryRoles || []).includes(role);
}

export function userHasAnyRole(user, roles) {
  if (!user || !roles?.length) return false;
  return roles.some((r) => userHasRole(user, r));
}

/** Deduped label for header badges, e.g. "admin · doctor" */
export function formatUserRoles(user) {
  if (!user) return '';
  const parts = [user.role, ...(user.secondaryRoles || [])];
  return [...new Set(parts)].join(' · ');
}
