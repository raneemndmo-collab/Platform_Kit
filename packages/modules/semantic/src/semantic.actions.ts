/**
 * M11 Semantic Model + KPI Hub -- K3 Action Handlers
 *
 * Every mutation is registered as a K3 action via registerAction(manifest, handler).
 * Each handler returns ActionHandlerResult for audit + event pipeline.
 */

import { actionRegistry } from '../../../kernel/src/action-registry/action-registry.service.js';
import { SemanticService } from './semantic.service.js';
import type {
  CreateModelInput,
  UpdateModelInput,
  DefineDimensionInput,
  DefineFactInput,
  CreateRelationshipInput,
  CreateKpiInput,
  UpdateKpiInput,
} from './semantic.types.js';

const svc = new SemanticService();

export function registerSemanticActions(): void {

  /* ═══════════════════════════════════════════
   * MODEL ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.create',
      display_name: 'Create Semantic Model',
      module_id: 'mod_semantic',
      verb: 'create',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateModelInput;
      const model = await svc.createModel(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: model,
        object_id: model.id,
        object_type: 'semantic_model',
        before: null,
        after: model,
        event_type: 'rasid.mod.semantic.model.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.update',
      display_name: 'Update Semantic Model',
      module_id: 'mod_semantic',
      verb: 'update',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id, ...rest } = input as UpdateModelInput;
      const model = await svc.updateModel(sql, id, rest);
      return {
        data: model,
        object_id: model.id,
        object_type: 'semantic_model',
        before: null,
        after: model,
        event_type: 'rasid.mod.semantic.model.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.publish',
      display_name: 'Publish Semantic Model',
      module_id: 'mod_semantic',
      verb: 'update',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.publish'],
      sensitivity: 'elevated',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const model = await svc.publishModel(sql, id);
      return {
        data: model,
        object_id: model.id,
        object_type: 'semantic_model',
        before: null,
        after: model,
        event_type: 'rasid.mod.semantic.model.published',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.delete',
      display_name: 'Delete Semantic Model',
      module_id: 'mod_semantic',
      verb: 'delete',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.delete'],
      sensitivity: 'critical',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteModel(sql, id);
      return {
        data: { deleted: true, id },
        object_id: id,
        object_type: 'semantic_model',
        before: null,
        after: null,
        event_type: 'rasid.mod.semantic.model.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * DIMENSION ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.dimension.define',
      display_name: 'Define Dimension',
      module_id: 'mod_semantic',
      verb: 'create',
      resource: 'semantic_dimensions',
      input_schema: { type: 'object', required: ['model_id', 'name'], properties: { model_id: { type: 'string' }, name: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_dimensions.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as DefineDimensionInput;
      const dim = await svc.defineDimension(sql, ctx.tenantId, data);
      return {
        data: dim,
        object_id: dim.id,
        object_type: 'semantic_dimension',
        before: null,
        after: dim,
        event_type: 'rasid.mod.semantic.dimension.defined',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.dimension.delete',
      display_name: 'Delete Dimension',
      module_id: 'mod_semantic',
      verb: 'delete',
      resource: 'semantic_dimensions',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_dimensions.delete'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteDimension(sql, id);
      return {
        data: { deleted: true, id },
        object_id: id,
        object_type: 'semantic_dimension',
        before: null,
        after: null,
        event_type: 'rasid.mod.semantic.dimension.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * FACT ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.fact.define',
      display_name: 'Define Fact',
      module_id: 'mod_semantic',
      verb: 'create',
      resource: 'semantic_facts',
      input_schema: { type: 'object', required: ['model_id', 'name', 'expression'], properties: { model_id: { type: 'string' }, name: { type: 'string' }, expression: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_facts.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as DefineFactInput;
      const fact = await svc.defineFact(sql, ctx.tenantId, data);
      return {
        data: fact,
        object_id: fact.id,
        object_type: 'semantic_fact',
        before: null,
        after: fact,
        event_type: 'rasid.mod.semantic.fact.defined',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.fact.delete',
      display_name: 'Delete Fact',
      module_id: 'mod_semantic',
      verb: 'delete',
      resource: 'semantic_facts',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_facts.delete'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteFact(sql, id);
      return {
        data: { deleted: true, id },
        object_id: id,
        object_type: 'semantic_fact',
        before: null,
        after: null,
        event_type: 'rasid.mod.semantic.fact.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * RELATIONSHIP ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.relationship.create',
      display_name: 'Create Relationship',
      module_id: 'mod_semantic',
      verb: 'create',
      resource: 'semantic_relationships',
      input_schema: { type: 'object', required: ['model_id', 'source_dimension_id', 'target_dimension_id'], properties: { model_id: { type: 'string' }, source_dimension_id: { type: 'string' }, target_dimension_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_relationships.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateRelationshipInput;
      const rel = await svc.createRelationship(sql, ctx.tenantId, data);
      return {
        data: rel,
        object_id: rel.id,
        object_type: 'semantic_relationship',
        before: null,
        after: rel,
        event_type: 'rasid.mod.semantic.relationship.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.relationship.delete',
      display_name: 'Delete Relationship',
      module_id: 'mod_semantic',
      verb: 'delete',
      resource: 'semantic_relationships',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_relationships.delete'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      await svc.deleteRelationship(sql, id);
      return {
        data: { deleted: true, id },
        object_id: id,
        object_type: 'semantic_relationship',
        before: null,
        after: null,
        event_type: 'rasid.mod.semantic.relationship.deleted',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * KPI ACTIONS
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.create',
      display_name: 'Create KPI',
      module_id: 'mod_semantic',
      verb: 'create',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['name', 'formula'], properties: { name: { type: 'string' }, formula: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.create'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as CreateKpiInput;
      const kpi = await svc.createKpi(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: kpi,
        object_id: kpi.id,
        object_type: 'kpi',
        before: null,
        after: kpi,
        event_type: 'rasid.mod.semantic.kpi.created',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.update',
      display_name: 'Update KPI',
      module_id: 'mod_semantic',
      verb: 'update',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.update'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const data = input as UpdateKpiInput;
      const kpi = await svc.updateKpi(sql, ctx.userId, data);
      return {
        data: kpi,
        object_id: kpi.id,
        object_type: 'kpi',
        before: null,
        after: kpi,
        event_type: 'rasid.mod.semantic.kpi.updated',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.approve',
      display_name: 'Approve KPI',
      module_id: 'mod_semantic',
      verb: 'update',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.approve'],
      sensitivity: 'elevated',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const kpi = await svc.approveKpi(sql, id, ctx.userId);
      return {
        data: kpi,
        object_id: kpi.id,
        object_type: 'kpi',
        before: null,
        after: kpi,
        event_type: 'rasid.mod.semantic.kpi.approved',
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.deprecate',
      display_name: 'Deprecate KPI',
      module_id: 'mod_semantic',
      verb: 'update',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.deprecate'],
      sensitivity: 'elevated',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const kpi = await svc.deprecateKpi(sql, id);
      return {
        data: kpi,
        object_id: kpi.id,
        object_type: 'kpi',
        before: null,
        after: kpi,
        event_type: 'rasid.mod.semantic.kpi.deprecated',
      };
    },
  );

  /* ═══════════════════════════════════════════
   * READ ACTIONS (via K3 for RBAC enforcement)
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.list',
      display_name: 'List Semantic Models',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_models',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['semantic_models.read'],
      sensitivity: 'standard',
    },
    async (_input, ctx, sql) => {
      const models = await svc.listModels(sql, ctx.tenantId);
      return {
        data: models,
        object_id: null,
        object_type: 'semantic_model',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.model.get',
      display_name: 'Get Semantic Model',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.read'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const model = await svc.getModel(sql, id);
      return {
        data: model,
        object_id: id,
        object_type: 'semantic_model',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.dimension.list',
      display_name: 'List Dimensions',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['model_id'], properties: { model_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { model_id } = input as { model_id: string };
      const dims = await svc.listDimensions(sql, model_id);
      return {
        data: dims,
        object_id: model_id,
        object_type: 'semantic_dimension',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.fact.list',
      display_name: 'List Facts',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['model_id'], properties: { model_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { model_id } = input as { model_id: string };
      const facts = await svc.listFacts(sql, model_id);
      return {
        data: facts,
        object_id: model_id,
        object_type: 'semantic_fact',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.relationship.list',
      display_name: 'List Relationships',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_models',
      input_schema: { type: 'object', required: ['model_id'], properties: { model_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_models.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { model_id } = input as { model_id: string };
      const rels = await svc.listRelationships(sql, model_id);
      return {
        data: rels,
        object_id: model_id,
        object_type: 'semantic_relationship',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.list',
      display_name: 'List KPIs',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', properties: {} },
      output_schema: {},
      required_permissions: ['semantic_kpis.read'],
      sensitivity: 'standard',
    },
    async (_input, ctx, sql) => {
      const kpis = await svc.listKpis(sql, ctx.tenantId);
      return {
        data: kpis,
        object_id: null,
        object_type: 'kpi',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.get',
      display_name: 'Get KPI',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { id } = input as { id: string };
      const kpi = await svc.getKpi(sql, id);
      return {
        data: kpi,
        object_id: id,
        object_type: 'kpi',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.kpi.versions',
      display_name: 'List KPI Versions',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['kpi_id'], properties: { kpi_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.read'],
      sensitivity: 'standard',
    },
    async (input, _ctx, sql) => {
      const { kpi_id } = input as { kpi_id: string };
      const versions = await svc.getKpiVersions(sql, kpi_id);
      return {
        data: versions,
        object_id: kpi_id,
        object_type: 'kpi',
        before: null,
        after: null,
        event_type: null,
      };
    },
  );

  /* ═══════════════════════════════════════════
   * IMPACT PREVIEW (via K3 for audit trail)
   * ═══════════════════════════════════════════ */

  actionRegistry.registerAction(
    {
      action_id: 'rasid.mod.semantic.impact.preview',
      display_name: 'Preview KPI Impact',
      module_id: 'mod_semantic',
      verb: 'read',
      resource: 'semantic_kpis',
      input_schema: { type: 'object', required: ['kpi_id'], properties: { kpi_id: { type: 'string' } } },
      output_schema: {},
      required_permissions: ['semantic_kpis.preview'],
      sensitivity: 'standard',
    },
    async (input, ctx, sql) => {
      const { kpi_id } = input as { kpi_id: string };
      const result = await svc.previewImpact(sql, kpi_id);
      return {
        data: result,
        object_id: kpi_id,
        object_type: 'kpi',
        before: null,
        after: result,
        event_type: 'rasid.mod.semantic.impact.detected',
      };
    },
  );
}
