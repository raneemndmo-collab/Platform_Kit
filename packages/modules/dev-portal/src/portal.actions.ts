/**
 * M32 Developer Portal — K3 Action Registration (Metadata Only)
 * Schema: mod_portal — no cross-schema queries.
 * No external SDK publishing. No OpenAPI runtime generator.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { PortalService } from './portal.service.js';

const svc = new PortalService();
const MOD = 'rasid.mod.portal';
const MID = 'mod_portal';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerPortalActions(): void {
  /* ── Portal API Keys ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.list`, display_name: 'List Portal API Keys', module_id: MID, resource: 'portal_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listKeys(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.get`, display_name: 'Get Portal API Key', module_id: MID, resource: 'portal_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getKey(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'portal_key' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.create`, display_name: 'Create Portal API Key', module_id: MID, resource: 'portal_keys', verb: 'create', sensitivity: 'critical', required_permissions: ['portal_keys.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createKey(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'portal_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.update`, display_name: 'Update Portal API Key', module_id: MID, resource: 'portal_keys', verb: 'update', sensitivity: 'standard', required_permissions: ['portal_keys.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateKey(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'portal_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.delete`, display_name: 'Delete Portal API Key', module_id: MID, resource: 'portal_keys', verb: 'delete', sensitivity: 'critical', required_permissions: ['portal_keys.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteKey(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'portal_key' }; },
  );

  /* ── Usage Logs ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.usage.list`, display_name: 'List Portal Usage Logs', module_id: MID, resource: 'portal_usage', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_usage.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listUsageLogs(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.usage.create`, display_name: 'Create Portal Usage Log', module_id: MID, resource: 'portal_usage', verb: 'create', sensitivity: 'standard', required_permissions: ['portal_usage.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createUsageLog(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'portal_usage_log', after: data }; },
  );

  /* ── Doc Pages ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.doc.list`, display_name: 'List Doc Pages', module_id: MID, resource: 'portal_docs', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_docs.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listDocPages(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.doc.get`, display_name: 'Get Doc Page', module_id: MID, resource: 'portal_docs', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_docs.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getDocPage(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'portal_doc' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.doc.create`, display_name: 'Create Doc Page', module_id: MID, resource: 'portal_docs', verb: 'create', sensitivity: 'standard', required_permissions: ['portal_docs.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createDocPage(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'portal_doc', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.doc.update`, display_name: 'Update Doc Page', module_id: MID, resource: 'portal_docs', verb: 'update', sensitivity: 'standard', required_permissions: ['portal_docs.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateDocPage(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'portal_doc', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.doc.delete`, display_name: 'Delete Doc Page', module_id: MID, resource: 'portal_docs', verb: 'delete', sensitivity: 'standard', required_permissions: ['portal_docs.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteDocPage(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'portal_doc' }; },
  );

  /* ── Webhooks ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.webhook.list`, display_name: 'List Webhooks', module_id: MID, resource: 'portal_webhooks', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_webhooks.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listWebhooks(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.webhook.get`, display_name: 'Get Webhook', module_id: MID, resource: 'portal_webhooks', verb: 'read', sensitivity: 'standard', required_permissions: ['portal_webhooks.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getWebhook(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'portal_webhook' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.webhook.create`, display_name: 'Create Webhook', module_id: MID, resource: 'portal_webhooks', verb: 'create', sensitivity: 'critical', required_permissions: ['portal_webhooks.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createWebhook(sql, ctx.tenantId, ctx.userId, input); return { data, object_id: data.id, object_type: 'portal_webhook', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.webhook.update`, display_name: 'Update Webhook', module_id: MID, resource: 'portal_webhooks', verb: 'update', sensitivity: 'standard', required_permissions: ['portal_webhooks.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateWebhook(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'portal_webhook', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.webhook.delete`, display_name: 'Delete Webhook', module_id: MID, resource: 'portal_webhooks', verb: 'delete', sensitivity: 'critical', required_permissions: ['portal_webhooks.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteWebhook(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'portal_webhook' }; },
  );
}
