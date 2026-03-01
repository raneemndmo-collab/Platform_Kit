/**
 * M29 API Gateway Hardening — K3 Action Registration (Metadata Only)
 * Schema: mod_gateway — no cross-schema queries.
 * No actual network enforcement. Configuration metadata only.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { GatewayService } from './gateway.service.js';

const svc = new GatewayService();
const MOD = 'rasid.mod.gateway';
const MID = 'mod_gateway';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerGatewayActions(): void {
  /* ── API Keys ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.apikey.list`, display_name: 'List Gateway API Keys', module_id: MID, resource: 'gw_api_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['gw_api_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listApiKeys(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.apikey.get`, display_name: 'Get Gateway API Key', module_id: MID, resource: 'gw_api_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['gw_api_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getApiKey(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'gw_api_key' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.apikey.create`, display_name: 'Create Gateway API Key', module_id: MID, resource: 'gw_api_keys', verb: 'create', sensitivity: 'critical', required_permissions: ['gw_api_keys.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createApiKey(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'gw_api_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.apikey.update`, display_name: 'Update Gateway API Key', module_id: MID, resource: 'gw_api_keys', verb: 'update', sensitivity: 'standard', required_permissions: ['gw_api_keys.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateApiKey(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'gw_api_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.apikey.delete`, display_name: 'Delete Gateway API Key', module_id: MID, resource: 'gw_api_keys', verb: 'delete', sensitivity: 'critical', required_permissions: ['gw_api_keys.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteApiKey(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'gw_api_key' }; },
  );

  /* ── IP Allowlist ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.ip.list`, display_name: 'List IP Allowlist', module_id: MID, resource: 'gw_ip_allowlist', verb: 'read', sensitivity: 'standard', required_permissions: ['gw_ip_allowlist.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listIpAllowlist(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ip.create`, display_name: 'Create IP Allowlist Entry', module_id: MID, resource: 'gw_ip_allowlist', verb: 'create', sensitivity: 'standard', required_permissions: ['gw_ip_allowlist.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createIpEntry(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'gw_ip_entry', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ip.update`, display_name: 'Update IP Allowlist Entry', module_id: MID, resource: 'gw_ip_allowlist', verb: 'update', sensitivity: 'standard', required_permissions: ['gw_ip_allowlist.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateIpEntry(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'gw_ip_entry', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ip.delete`, display_name: 'Delete IP Allowlist Entry', module_id: MID, resource: 'gw_ip_allowlist', verb: 'delete', sensitivity: 'standard', required_permissions: ['gw_ip_allowlist.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteIpEntry(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'gw_ip_entry' }; },
  );

  /* ── Rate Limits ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.ratelimit.list`, display_name: 'List Rate Limit Configs', module_id: MID, resource: 'gw_rate_limits', verb: 'read', sensitivity: 'standard', required_permissions: ['gw_rate_limits.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listRateLimits(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ratelimit.create`, display_name: 'Create Rate Limit Config', module_id: MID, resource: 'gw_rate_limits', verb: 'create', sensitivity: 'standard', required_permissions: ['gw_rate_limits.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createRateLimit(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'gw_rate_limit', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ratelimit.update`, display_name: 'Update Rate Limit Config', module_id: MID, resource: 'gw_rate_limits', verb: 'update', sensitivity: 'standard', required_permissions: ['gw_rate_limits.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateRateLimit(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'gw_rate_limit', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.ratelimit.delete`, display_name: 'Delete Rate Limit Config', module_id: MID, resource: 'gw_rate_limits', verb: 'delete', sensitivity: 'standard', required_permissions: ['gw_rate_limits.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteRateLimit(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'gw_rate_limit' }; },
  );
}
