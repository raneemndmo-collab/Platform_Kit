/**
 * Seed ALL required permissions into the DB and link to admin roles.
 * Covers every required_permissions string used across all action files.
 */
import { adminSql } from '../packages/kernel/src/db/connection.js';
import { v7 as uuidv7 } from 'uuid';

const ALL_PERMS = [
  'ai_agent_executions.create','ai_agent_executions.read',
  'ai_agents.create','ai_agents.delete','ai_agents.read','ai_agents.update',
  'ai_conversations.create','ai_conversations.delete','ai_conversations.read','ai_conversations.update',
  'ai_guardrail_evaluations.read',
  'ai_guardrail_rules.create','ai_guardrail_rules.delete','ai_guardrail_rules.read','ai_guardrail_rules.update',
  'ai_memory_entries.create','ai_memory_entries.read',
  'ai_memory_sessions.create','ai_memory_sessions.delete','ai_memory_sessions.read','ai_memory_sessions.update',
  'ai_messages.create','ai_messages.read',
  'ai_proactive_rules.create','ai_proactive_rules.delete','ai_proactive_rules.read','ai_proactive_rules.update',
  'ai_proactive_suggestions.create','ai_proactive_suggestions.read','ai_proactive_suggestions.update',
  'ai_rag_retrieval.create','ai_rag_retrieval.read',
  'ai_rag_sources.create','ai_rag_sources.delete','ai_rag_sources.read','ai_rag_sources.update',
  'ai_tool_bindings.create','ai_tool_bindings.delete','ai_tool_bindings.read',
  'ai_tool_definitions.create','ai_tool_definitions.delete','ai_tool_definitions.read','ai_tool_definitions.update',
  'ai_tool_invocations.create','ai_tool_invocations.read',
  'backup_jobs.create','backup_jobs.delete','backup_jobs.read','backup_jobs.update',
  'backup_policies.create','backup_policies.delete','backup_policies.read','backup_policies.update',
  'backup_restores.create','backup_restores.read','backup_restores.update',
  'billing_flags.create','billing_flags.delete','billing_flags.read','billing_flags.update',
  'billing_plans.create','billing_plans.delete','billing_plans.read','billing_plans.update',
  'billing_quotas.create','billing_quotas.delete','billing_quotas.read','billing_quotas.update',
  'billing_subscriptions.create','billing_subscriptions.read','billing_subscriptions.update',
  'billing_usage.create','billing_usage.read',
  'compositions.create','compositions.delete','compositions.update',
  'custom_table_rows.create','custom_table_rows.delete','custom_table_rows.update',
  'custom_tables.create','custom_tables.delete','custom_tables.update',
  'dashboard_widgets.create','dashboard_widgets.delete','dashboard_widgets.query','dashboard_widgets.read','dashboard_widgets.update',
  'dashboards.create','dashboards.delete','dashboards.publish','dashboards.read','dashboards.share','dashboards.update',
  'files.create','files.delete','files.read','files.update',
  'folders.create','folders.delete','folders.read','folders.update',
  'forms.create','forms.delete','forms.publish','forms.read','forms.update',
  'gap_analyses.create',
  'gw_api_keys.create','gw_api_keys.delete','gw_api_keys.read','gw_api_keys.update',
  'gw_ip_allowlist.create','gw_ip_allowlist.delete','gw_ip_allowlist.read','gw_ip_allowlist.update',
  'gw_rate_limits.create','gw_rate_limits.delete','gw_rate_limits.read','gw_rate_limits.update',
  'l10n_keys.create','l10n_keys.delete','l10n_keys.read','l10n_keys.update',
  'l10n_languages.create','l10n_languages.delete','l10n_languages.read','l10n_languages.update',
  'l10n_translations.create','l10n_translations.delete','l10n_translations.read','l10n_translations.update',
  'libraries.create','libraries.delete','libraries.update',
  'notification_channels.create','notification_channels.delete','notification_channels.update',
  'notification_preferences.update',
  'notification_templates.create','notification_templates.delete','notification_templates.update',
  'notifications.create','notifications.update',
  'objects.create','objects.delete','objects.update',
  'obs_alert_history.create','obs_alert_history.read','obs_alert_history.update',
  'obs_alerts.create','obs_alerts.delete','obs_alerts.read','obs_alerts.update',
  'obs_incidents.create','obs_incidents.read','obs_incidents.update',
  'obs_metrics.create','obs_metrics.delete','obs_metrics.read','obs_metrics.update',
  'obs_slos.create','obs_slos.delete','obs_slos.read','obs_slos.update',
  'page_sections.create','page_sections.delete','page_sections.update',
  'pages.create','pages.delete','pages.publish','pages.read','pages.update',
  'portal_docs.create','portal_docs.delete','portal_docs.read','portal_docs.update',
  'portal_keys.create','portal_keys.delete','portal_keys.read','portal_keys.update',
  'portal_usage.create','portal_usage.read',
  'portal_webhooks.create','portal_webhooks.delete','portal_webhooks.read','portal_webhooks.update',
  'presentations.create','presentations.delete','presentations.publish','presentations.read','presentations.update',
  'report_runs.execute','report_runs.read',
  'reports.create','reports.delete','reports.publish','reports.read','reports.update',
  'search_analytics.read',
  'search_index.create','search_index.delete','search_index.read','search_index.reindex',
  'search_synonyms.create','search_synonyms.delete','search_synonyms.read','search_synonyms.update',
  'semantic_dimensions.create','semantic_dimensions.delete',
  'semantic_facts.create','semantic_facts.delete',
  'semantic_kpis.approve','semantic_kpis.create','semantic_kpis.deprecate','semantic_kpis.preview','semantic_kpis.read','semantic_kpis.update',
  'semantic_models.create','semantic_models.delete','semantic_models.publish','semantic_models.read','semantic_models.update',
  'semantic_relationships.create','semantic_relationships.delete',
  'slides.create','slides.delete','slides.update',
  'submissions.create','submissions.delete','submissions.read',
];

async function main() {
  const [acme] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'acme'`;
  const [beta] = await adminSql`SELECT id FROM kernel.tenants WHERE slug = 'beta'`;
  const [acmeAdmin] = await adminSql`SELECT id FROM kernel.roles WHERE name = 'admin' AND tenant_id = ${acme.id}`;
  const betaAdminRows = await adminSql`SELECT id FROM kernel.roles WHERE name = 'admin' AND tenant_id = ${beta.id}`;
  const betaAdmin = betaAdminRows[0] || null;

  let created = 0, linked = 0;

  for (const perm of ALL_PERMS) {
    const [resource, action] = perm.split('.');
    
    // Upsert permission
    const existing = await adminSql`SELECT id FROM kernel.permissions WHERE resource = ${resource} AND action = ${action}`;
    let permId: string;
    if (existing.length === 0) {
      permId = uuidv7();
      await adminSql`INSERT INTO kernel.permissions (id, resource, action) VALUES (${permId}, ${resource}, ${action})`;
      created++;
    } else {
      permId = existing[0].id as string;
    }

    // Link to acme admin
    const acmeLink = await adminSql`SELECT 1 FROM kernel.role_permissions WHERE role_id = ${acmeAdmin.id} AND permission_id = ${permId}`;
    if (acmeLink.length === 0) {
      await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${acmeAdmin.id}, ${permId}, ${acme.id})`;
      linked++;
    }

    // Link to beta admin (if exists)
    if (betaAdmin) {
      const betaLink = await adminSql`SELECT 1 FROM kernel.role_permissions WHERE role_id = ${betaAdmin.id} AND permission_id = ${permId}`;
      if (betaLink.length === 0) {
        await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${betaAdmin.id}, ${permId}, ${beta.id})`;
        linked++;
      }
    }
  }

  console.log(`Created ${created} permissions, linked ${linked} role_permissions`);
  const [count] = await adminSql`SELECT count(*) AS c FROM kernel.permissions`;
  const [rpCount] = await adminSql`SELECT count(*) AS c FROM kernel.role_permissions`;
  console.log(`Total permissions: ${count.c}, Total role_permissions: ${rpCount.c}`);

  await adminSql.end();
}

main().catch(console.error);
