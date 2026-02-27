/** Request to evaluate a policy decision */
export interface PolicyRequest {
  actor_id: string;
  tenant_id: string;
  required_permissions: string[];  // e.g. ['objects.create']
}

/** Result of a policy evaluation */
export interface PolicyDecision {
  allowed: boolean;
  missing_permissions: string[];
}
