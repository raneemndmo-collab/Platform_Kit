import type { PolicyRequest, PolicyDecision } from './policy.types.js';

/** K4 Policy Engine — public contract */
export interface IPolicyEngine {
  evaluate(request: PolicyRequest): Promise<PolicyDecision>;
}
