/**
 * Reseed helper — re-creates seed data inside test process
 * Used by tests that run after step2 (which destroys seed data)
 */
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { adminSql } from '../../packages/kernel/src/db/connection.js';

const SALT_ROUNDS = 10;

export async function reseed(): Promise<void> {
  // Clean
  await adminSql`DELETE FROM mod_ai.proactive_suggestions`;
  await adminSql`DELETE FROM mod_ai.proactive_rules`;
  await adminSql`DELETE FROM mod_ai.guardrail_evaluations`;
  await adminSql`DELETE FROM mod_ai.guardrail_rules`;
  await adminSql`DELETE FROM mod_ai.memory_entries`;
  await adminSql`DELETE FROM mod_ai.memory_sessions`;
  await adminSql`DELETE FROM mod_ai.rag_retrieval_logs`;
  await adminSql`DELETE FROM mod_ai.rag_sources`;
  await adminSql`DELETE FROM mod_ai.agent_executions`;
  await adminSql`DELETE FROM mod_ai.agent_definitions`;
  await adminSql`DELETE FROM mod_ai.tool_bindings`;
  await adminSql`DELETE FROM mod_ai.tool_definitions`;
  await adminSql`DELETE FROM mod_ai.tool_invocations`;
  await adminSql`DELETE FROM mod_ai.messages`;
  await adminSql`DELETE FROM mod_ai.conversations`;
  await adminSql`DELETE FROM mod_forms.submissions`;
  await adminSql`DELETE FROM mod_forms.forms`;
  await adminSql`DELETE FROM mod_presentations.presentations`;
  await adminSql`DELETE FROM mod_custom_pages.pages`;
  await adminSql`DELETE FROM mod_reports.report_runs`;
  await adminSql`DELETE FROM mod_reports.report_definitions`;
  await adminSql`DELETE FROM mod_file_manager.files`;
  await adminSql`DELETE FROM mod_file_manager.folders`;
  await adminSql`DELETE FROM mod_dashboard.shared_dashboards`;
  await adminSql`DELETE FROM mod_dashboard.widgets`;
  await adminSql`DELETE FROM mod_dashboard.dashboards`;
  await adminSql`DELETE FROM mod_search.search_analytics`;
  await adminSql`DELETE FROM mod_search.search_synonyms`;
  await adminSql`DELETE FROM mod_search.search_index`;
  await adminSql`DELETE FROM mod_semantic.kpi_versions`;
  await adminSql`DELETE FROM mod_semantic.relationships`;
  await adminSql`DELETE FROM mod_semantic.facts`;
  await adminSql`DELETE FROM mod_semantic.dimensions`;
  await adminSql`DELETE FROM mod_semantic.kpis`;
  await adminSql`DELETE FROM mod_semantic.models`;
  await adminSql`DELETE FROM mod_sheetforge.gap_analyses`;
  await adminSql`DELETE FROM mod_sheetforge.compositions`;
  await adminSql`DELETE FROM mod_sheetforge.sheets`;
  await adminSql`DELETE FROM mod_sheetforge.libraries`;
  await adminSql`DELETE FROM mod_connectors.custom_table_rows`;
  await adminSql`DELETE FROM mod_connectors.custom_tables`;
  await adminSql`DELETE FROM kernel.notification_preferences`;
  await adminSql`DELETE FROM kernel.notifications`;
  await adminSql`DELETE FROM kernel.notification_templates`;
  await adminSql`DELETE FROM kernel.notification_channels`;
  await adminSql`DELETE FROM kernel.design_components`;
  await adminSql`DELETE FROM kernel.design_themes`;
  await adminSql`DELETE FROM kernel.design_tokens`;
  await adminSql`DELETE FROM kernel.metrics`;
  await adminSql`DELETE FROM kernel.dataset_fields`;
  await adminSql`DELETE FROM kernel.datasets`;
  await adminSql`DELETE FROM kernel.lineage_edges`;
  await adminSql`DELETE FROM kernel.user_roles`;
  await adminSql`DELETE FROM kernel.role_permissions`;
  await adminSql`DELETE FROM kernel.audit_log`;
  await adminSql`DELETE FROM kernel.objects`;
  await adminSql`DELETE FROM kernel.object_types`;
  await adminSql`DELETE FROM kernel.users`;
  await adminSql`DELETE FROM kernel.roles`;
  await adminSql`DELETE FROM kernel.permissions`;
  await adminSql`DELETE FROM kernel.action_manifests`;
  await adminSql`DELETE FROM kernel.tenants`;

  // Tenants
  const acmeId = uuidv7();
  const betaId = uuidv7();
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${acmeId}, 'Acme Corporation', 'acme')`;
  await adminSql`INSERT INTO kernel.tenants (id, name, slug) VALUES (${betaId}, 'Beta Industries', 'beta')`;

  // Permissions
  const permDefs: Array<[string, string]> = [
    ['users', 'create'], ['users', 'read'], ['users', 'update'], ['users', 'delete'],
    ['roles', 'create'], ['roles', 'read'], ['roles', 'update'], ['roles', 'delete'], ['roles', 'assign'],
    ['permissions', 'assign'],
    ['objects', 'create'], ['objects', 'read'], ['objects', 'update'], ['objects', 'delete'],
    ['audit', 'read'],
    ['notification_channels', 'create'], ['notification_channels', 'read'], ['notification_channels', 'update'], ['notification_channels', 'delete'],
    ['notification_templates', 'create'], ['notification_templates', 'read'], ['notification_templates', 'update'], ['notification_templates', 'delete'],
    ['notifications', 'create'], ['notifications', 'read'], ['notifications', 'update'],
    ['notification_preferences', 'read'], ['notification_preferences', 'update'],
    ['custom_tables', 'create'], ['custom_tables', 'read'], ['custom_tables', 'update'], ['custom_tables', 'delete'],
    ['custom_table_rows', 'create'], ['custom_table_rows', 'read'], ['custom_table_rows', 'update'], ['custom_table_rows', 'delete'],
    ['libraries', 'create'], ['libraries', 'read'], ['libraries', 'update'], ['libraries', 'delete'],
    ['compositions', 'create'], ['compositions', 'read'], ['compositions', 'update'], ['compositions', 'delete'],
    ['gap_analyses', 'create'], ['gap_analyses', 'read'],
    ['semantic_models', 'create'], ['semantic_models', 'read'], ['semantic_models', 'update'], ['semantic_models', 'delete'], ['semantic_models', 'publish'],
    ['semantic_dimensions', 'create'], ['semantic_dimensions', 'delete'],
    ['semantic_facts', 'create'], ['semantic_facts', 'delete'],
    ['semantic_relationships', 'create'], ['semantic_relationships', 'delete'],
    ['semantic_kpis', 'create'], ['semantic_kpis', 'read'], ['semantic_kpis', 'update'], ['semantic_kpis', 'approve'], ['semantic_kpis', 'deprecate'], ['semantic_kpis', 'preview'],
    ['search_index', 'create'], ['search_index', 'read'], ['search_index', 'delete'], ['search_index', 'reindex'],
    ['search_synonyms', 'create'], ['search_synonyms', 'read'], ['search_synonyms', 'update'], ['search_synonyms', 'delete'],
    ['search_analytics', 'read'],
    ['dashboards', 'create'], ['dashboards', 'read'], ['dashboards', 'update'], ['dashboards', 'delete'], ['dashboards', 'publish'], ['dashboards', 'share'],
    ['dashboard_widgets', 'create'], ['dashboard_widgets', 'read'], ['dashboard_widgets', 'update'], ['dashboard_widgets', 'delete'], ['dashboard_widgets', 'query'],
    ['folders', 'create'], ['folders', 'read'], ['folders', 'update'], ['folders', 'delete'],
    ['files', 'create'], ['files', 'read'], ['files', 'update'], ['files', 'delete'],
    // M10 — Reports Engine
    ['reports', 'create'], ['reports', 'read'], ['reports', 'update'], ['reports', 'delete'], ['reports', 'publish'],
    ['report_runs', 'execute'], ['report_runs', 'read'],
    ['pages', 'create'], ['pages', 'read'], ['pages', 'update'], ['pages', 'delete'], ['pages', 'publish'],
    ['page_sections', 'create'], ['page_sections', 'read'], ['page_sections', 'update'], ['page_sections', 'delete'],
    // M16 — Presentations
    ['presentations', 'create'], ['presentations', 'read'], ['presentations', 'update'], ['presentations', 'delete'], ['presentations', 'publish'],
    ['slides', 'create'], ['slides', 'read'], ['slides', 'update'], ['slides', 'delete'],
    // M15 — Forms Builder
    ['forms', 'create'], ['forms', 'read'], ['forms', 'update'], ['forms', 'delete'], ['forms', 'publish'],
    ['submissions', 'create'], ['submissions', 'read'], ['submissions', 'delete'],
    // M21 — AI Engine (Step 1: Core)
    ['ai_conversations', 'create'], ['ai_conversations', 'read'], ['ai_conversations', 'update'], ['ai_conversations', 'delete'],
    ['ai_messages', 'create'], ['ai_messages', 'read'],
    ['ai_tool_invocations', 'create'], ['ai_tool_invocations', 'read'],
    // M21 — AI Engine (Step 2: Tool Registry)
    ['ai_tool_definitions', 'create'], ['ai_tool_definitions', 'read'], ['ai_tool_definitions', 'update'], ['ai_tool_definitions', 'delete'],
    ['ai_tool_bindings', 'create'], ['ai_tool_bindings', 'read'], ['ai_tool_bindings', 'delete'],
    // M21 — AI Engine (Step 3: Agent Framework Core)
    ['ai_agents', 'create'], ['ai_agents', 'read'], ['ai_agents', 'update'], ['ai_agents', 'delete'],
    ['ai_agent_executions', 'create'], ['ai_agent_executions', 'read'],
    // M21 — AI Engine (Step 4: RAG Engine)
    ['ai_rag_sources', 'create'], ['ai_rag_sources', 'read'], ['ai_rag_sources', 'update'], ['ai_rag_sources', 'delete'],
    ['ai_rag_retrieval', 'create'], ['ai_rag_retrieval', 'read'],
    // M21 — AI Engine (Step 5: Memory Layer)
    ['ai_memory_sessions', 'create'], ['ai_memory_sessions', 'read'], ['ai_memory_sessions', 'update'], ['ai_memory_sessions', 'delete'],
    ['ai_memory_entries', 'create'], ['ai_memory_entries', 'read'],
    // M21 — AI Engine (Step 6: Guardrails)
    ['ai_guardrail_rules', 'create'], ['ai_guardrail_rules', 'read'], ['ai_guardrail_rules', 'update'], ['ai_guardrail_rules', 'delete'],
    ['ai_guardrail_evaluations', 'read'],
    // M21 — AI Engine (Step 7: Proactive Engine)
    ['ai_proactive_rules', 'create'], ['ai_proactive_rules', 'read'], ['ai_proactive_rules', 'update'], ['ai_proactive_rules', 'delete'],
    ['ai_proactive_suggestions', 'create'], ['ai_proactive_suggestions', 'read'], ['ai_proactive_suggestions', 'update'],
  ];
  const permIds: Record<string, string> = {};
  for (const [resource, action] of permDefs) {
    const id = uuidv7();
    permIds[`${resource}.${action}`] = id;
    await adminSql`INSERT INTO kernel.permissions (id, resource, action) VALUES (${id}, ${resource}, ${action})`;
  }

  // Roles
  const roleDefs: Array<{ name: string; perms: string[] }> = [
    { name: 'super_admin', perms: Object.keys(permIds) },
    { name: 'admin', perms: Object.keys(permIds).filter((p) => p !== 'permissions.assign') },
    { name: 'editor', perms: ['users.read', 'objects.create', 'objects.read', 'objects.update', 'objects.delete', 'audit.read'] },
    { name: 'viewer', perms: ['users.read', 'objects.read', 'audit.read'] },
  ];

  const roleMap: Record<string, Record<string, string>> = {};
  for (const tenantId of [acmeId, betaId]) {
    roleMap[tenantId] = {};
    for (const role of roleDefs) {
      const roleId = uuidv7();
      roleMap[tenantId][role.name] = roleId;
      await adminSql`INSERT INTO kernel.roles (id, tenant_id, name, is_system) VALUES (${roleId}, ${tenantId}, ${role.name}, true)`;
      for (const perm of role.perms) {
        const permId = permIds[perm];
        if (permId) {
          await adminSql`INSERT INTO kernel.role_permissions (role_id, permission_id, tenant_id) VALUES (${roleId}, ${permId}, ${tenantId})`;
        }
      }
    }
  }

  // Users
  const userDefs: Array<{ email: string; password: string; name: string; tenant: string; roles: string[] }> = [
    { email: 'admin@acme.com', password: 'Admin123!', name: 'Acme Admin', tenant: acmeId, roles: ['super_admin'] },
    { email: 'editor@acme.com', password: 'Editor123!', name: 'Acme Editor', tenant: acmeId, roles: ['editor'] },
    { email: 'viewer@acme.com', password: 'Viewer123!', name: 'Acme Viewer', tenant: acmeId, roles: ['viewer'] },
    { email: 'admin@beta.com', password: 'Admin123!', name: 'Beta Admin', tenant: betaId, roles: ['super_admin'] },
    { email: 'viewer@beta.com', password: 'Viewer123!', name: 'Beta Viewer', tenant: betaId, roles: ['viewer'] },
  ];

  for (const u of userDefs) {
    const userId = uuidv7();
    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    await adminSql`
      INSERT INTO kernel.users (id, tenant_id, email, password_hash, display_name)
      VALUES (${userId}, ${u.tenant}, ${u.email}, ${hash}, ${u.name})
    `;
    for (const roleName of u.roles) {
      const roleId = roleMap[u.tenant][roleName];
      await adminSql`
        INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by)
        VALUES (${userId}, ${roleId}, ${u.tenant}, ${userId})
      `;
    }
  }

  // Object type
  await adminSql`
    INSERT INTO kernel.object_types (name, display_name, module_id, json_schema)
    VALUES ('rasid.core.test', 'Test Object', 'kernel', ${JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, value: { type: 'number' } },
    })})
  `;
}
