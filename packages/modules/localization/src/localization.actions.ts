/**
 * M31 Localization — K3 Action Registration (Metadata Only)
 * Schema: mod_l10n — no cross-schema queries.
 * No runtime translation engine.
 */
import { actionRegistry } from '../../../kernel/src/index.js';
import { LocalizationService } from './localization.service.js';

const svc = new LocalizationService();
const MOD = 'rasid.mod.l10n';
const MID = 'mod_l10n';
const S = { type: 'object', properties: {} } as Record<string, unknown>;

export function registerLocalizationActions(): void {
  /* ── Languages ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.language.list`, display_name: 'List Languages', module_id: MID, resource: 'l10n_languages', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_languages.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listLanguages(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.language.get`, display_name: 'Get Language', module_id: MID, resource: 'l10n_languages', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_languages.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getLanguage(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'l10n_language' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.language.create`, display_name: 'Create Language', module_id: MID, resource: 'l10n_languages', verb: 'create', sensitivity: 'standard', required_permissions: ['l10n_languages.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createLanguage(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'l10n_language', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.language.update`, display_name: 'Update Language', module_id: MID, resource: 'l10n_languages', verb: 'update', sensitivity: 'standard', required_permissions: ['l10n_languages.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateLanguage(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'l10n_language', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.language.delete`, display_name: 'Delete Language', module_id: MID, resource: 'l10n_languages', verb: 'delete', sensitivity: 'standard', required_permissions: ['l10n_languages.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteLanguage(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'l10n_language' }; },
  );

  /* ── Translation Keys ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.list`, display_name: 'List Translation Keys', module_id: MID, resource: 'l10n_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listKeys(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.get`, display_name: 'Get Translation Key', module_id: MID, resource: 'l10n_keys', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_keys.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getKey(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'l10n_key' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.create`, display_name: 'Create Translation Key', module_id: MID, resource: 'l10n_keys', verb: 'create', sensitivity: 'standard', required_permissions: ['l10n_keys.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createKey(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'l10n_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.update`, display_name: 'Update Translation Key', module_id: MID, resource: 'l10n_keys', verb: 'update', sensitivity: 'standard', required_permissions: ['l10n_keys.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateKey(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'l10n_key', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.key.delete`, display_name: 'Delete Translation Key', module_id: MID, resource: 'l10n_keys', verb: 'delete', sensitivity: 'standard', required_permissions: ['l10n_keys.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteKey(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'l10n_key' }; },
  );

  /* ── Translations ── */
  actionRegistry.registerAction(
    { action_id: `${MOD}.translation.list`, display_name: 'List Translations', module_id: MID, resource: 'l10n_translations', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_translations.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.listTranslations(sql, ctx.tenantId, input); return { data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.translation.get`, display_name: 'Get Translation', module_id: MID, resource: 'l10n_translations', verb: 'read', sensitivity: 'standard', required_permissions: ['l10n_translations.read'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.getTranslation(sql, ctx.tenantId, input.id as string); return { data, object_id: data.id, object_type: 'l10n_translation' }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.translation.create`, display_name: 'Create Translation', module_id: MID, resource: 'l10n_translations', verb: 'create', sensitivity: 'standard', required_permissions: ['l10n_translations.create'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.createTranslation(sql, ctx.tenantId, input); return { data, object_id: data.id, object_type: 'l10n_translation', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.translation.update`, display_name: 'Update Translation', module_id: MID, resource: 'l10n_translations', verb: 'update', sensitivity: 'standard', required_permissions: ['l10n_translations.update'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.updateTranslation(sql, ctx.tenantId, input.id as string, input); return { data, object_id: data.id, object_type: 'l10n_translation', after: data }; },
  );
  actionRegistry.registerAction(
    { action_id: `${MOD}.translation.delete`, display_name: 'Delete Translation', module_id: MID, resource: 'l10n_translations', verb: 'delete', sensitivity: 'standard', required_permissions: ['l10n_translations.delete'], input_schema: S, output_schema: S },
    async (input, ctx, sql) => { const data = await svc.deleteTranslation(sql, ctx.tenantId, input.id as string); return { data, object_id: input.id as string, object_type: 'l10n_translation' }; },
  );
}
