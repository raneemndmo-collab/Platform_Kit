/**
 * Seed Phase 5 permissions into the database for benchmarking.
 * This adds all missing permissions and assigns them to the admin role.
 */
import { adminSql } from '../packages/kernel/src/db/connection.js';
import { v7 as uuidv7 } from 'uuid';

const RESOURCES = [
  // Phase 5 modules
  'backup_policies', 'backup_jobs', 'backup_restores',
  'gw_api_keys', 'gw_ip_allowlist', 'gw_rate_limits',
  'billing_plans', 'billing_flags', 'billing_usage', 'billing_quotas', 'billing_subscriptions',
  'l10n_languages', 'l10n_keys', 'l10n_translations',
  'portal_keys', 'portal_usage', 'portal_docs', 'portal_webhooks',
  // Phase 4 modules (may also be missing)
  'obs_metrics', 'obs_alerts', 'obs_alert_history', 'obs_slo', 'obs_incidents',
  'ai_conversations', 'ai_messages', 'ai_tool_definitions', 'ai_tool_bindings',
  'ai_tool_invocations', 'ai_agents', 'ai_agent_executions',
  'ai_rag_sources', 'ai_rag_logs', 'ai_memory_sessions', 'ai_memory_entries',
  'ai_guardrail_rules', 'ai_guardrail_evaluations', 'ai_proactive_rules', 'ai_proactive_suggestions',
  // Phase 3 modules
  'connectors', 'custom_tables', 'custom_table_rows',
  'sheetforge_libraries', 'sheetforge_sheets', 'sheetforge_compositions', 'sheetforge_gap_analyses',
  'semantic_models', 'semantic_dimensions', 'semantic_facts', 'semantic_kpis', 'semantic_kpi_versions',
  'search_index', 'search_synonyms', 'search_analytics',
  'dashboards', 'widgets', 'shared_dashboards',
  'files', 'folders',
  'report_definitions', 'report_runs',
  'custom_pages',
  'presentations',
  'forms', 'form_submissions',
  // Notification
  'notification_channels', 'notification_templates', 'notification_preferences', 'notifications',
  // Design
  'design_themes', 'design_tokens', 'design_components',
  // Lineage
  'lineage_edges',
  // Datasets
  'datasets', 'dataset_fields',
  // Metrics
  'metrics',
];

const ACTIONS = ['create', 'read', 'update', 'delete'];

async function main() {
  // Get the admin role ID for acme tenant
  const [acmeTenant] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'acme'`;
  const [adminRole] = await adminSql`SELECT id FROM kernel.roles WHERE name = 'admin' AND tenant_id = ${acmeTenant.id}`;
  
  console.log(`Acme tenant: ${acmeTenant.id}`);
  console.log(`Admin role: ${adminRole.id}`);

  // Also get beta tenant admin role
  const [betaTenant] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'beta'`;
  const betaRoles = await adminSql`SELECT id FROM kernel.roles WHERE name = 'admin' AND tenant_id = ${betaTenant.id}`;
  const betaAdminRole = betaRoles[0];

  let created = 0;
  let linked = 0;

  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      // Check if permission exists
      const existing = await adminSql`
        SELECT id FROM kernel.permissions WHERE resource = ${resource} AND action = ${action}`;
      
      let permId: string;
      if (existing.length === 0) {
        permId = uuidv7();
        await adminSql`
          INSERT INTO kernel.permissions (id, resource, action)
          VALUES (${permId}, ${resource}, ${action})`;
        created++;
      } else {
        permId = existing[0].id as string;
      }

      // Link to acme admin role
      const existingLink = await adminSql`
        SELECT 1 FROM kernel.role_permissions WHERE role_id = ${adminRole.id} AND permission_id = ${permId}`;
      if (existingLink.length === 0) {
        await adminSql`
          INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${adminRole.id}, ${permId}, ${acmeTenant.id})`;
        linked++;
      }

      // Link to beta admin role
      if (betaAdminRole) {
        const existingBetaLink = await adminSql`
          SELECT 1 FROM kernel.role_permissions WHERE role_id = ${betaAdminRole.id} AND permission_id = ${permId}`;
        if (existingBetaLink.length === 0) {
          await adminSql`
            INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${betaAdminRole.id}, ${permId}, ${betaTenant.id})`;
        }
      }
    }
  }

  console.log(`Created ${created} permissions, linked ${linked} to admin roles`);
  
  // Verify
  const [count] = await adminSql`SELECT count(*) AS c FROM kernel.permissions`;
  console.log(`Total permissions: ${count.c}`);

  await adminSql.end();
}

main().catch(console.error);
