/**
 * M11 Semantic Model + KPI Hub -- Service
 *
 * Data operations for models, dimensions, facts, relationships, KPIs, KPI versions.
 * All writes called from K3 action handlers.
 * Schema: mod_semantic
 * No direct DB access to other module schemas.
 */

import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import { ConflictError, NotFoundError } from '@rasid/shared';
import type { ISemanticService } from './semantic.interface.js';
import type {
  SemanticModel,
  Dimension,
  Fact,
  Relationship,
  Kpi,
  KpiVersion,
  CreateModelInput,
  UpdateModelInput,
  DefineDimensionInput,
  DefineFactInput,
  CreateRelationshipInput,
  CreateKpiInput,
  UpdateKpiInput,
  ImpactPreviewResult,
} from './semantic.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class SemanticService implements ISemanticService {

  /* ═══════════════════════════════════════════
   * MODEL OPERATIONS
   * ═══════════════════════════════════════════ */

  async createModel(sql: Sql, tenantId: string, userId: string, input: CreateModelInput): Promise<SemanticModel> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_semantic.models
          (id, tenant_id, name, description, version, status, created_by, created_at, updated_at)
        VALUES
          (${id}, ${tenantId}, ${input.name}, ${input.description ?? null},
           ${1}, 'draft', ${userId}, ${now}, ${now})
        RETURNING *
      `;
      return this.mapModel(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Model with name '${input.name}' already exists`);
      }
      throw err;
    }
  }

  async getModel(sql: Sql, modelId: string): Promise<SemanticModel | null> {
    const [row] = await sql`SELECT * FROM mod_semantic.models WHERE id = ${modelId}`;
    return row ? this.mapModel(row) : null;
  }

  async listModels(sql: Sql, tenantId: string): Promise<SemanticModel[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.models WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapModel(r));
  }

  async updateModel(sql: Sql, modelId: string, input: Omit<UpdateModelInput, 'id'>): Promise<SemanticModel> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_semantic.models SET
        name        = COALESCE(${input.name ?? null}, name),
        description = COALESCE(${input.description ?? null}, description),
        updated_at  = ${now}
      WHERE id = ${modelId}
      RETURNING *
    `;
    if (!row) throw new NotFoundError('Model not found');
    return this.mapModel(row);
  }

  async publishModel(sql: Sql, modelId: string): Promise<SemanticModel> {
    const model = await this.getModel(sql, modelId);
    if (!model) throw new NotFoundError('Model not found');
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_semantic.models SET
        status     = 'published',
        version    = version + 1,
        updated_at = ${now}
      WHERE id = ${modelId}
      RETURNING *
    `;
    return this.mapModel(row);
  }

  async deleteModel(sql: Sql, modelId: string): Promise<void> {
    await sql`DELETE FROM mod_semantic.models WHERE id = ${modelId}`;
  }

  /* ═══════════════════════════════════════════
   * DIMENSION OPERATIONS
   * ═══════════════════════════════════════════ */

  async defineDimension(sql: Sql, tenantId: string, input: DefineDimensionInput): Promise<Dimension> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_semantic.dimensions
          (id, model_id, tenant_id, name, source_column, dim_type, hierarchy, description, created_at)
        VALUES
          (${id}, ${input.model_id}, ${tenantId}, ${input.name},
           ${input.source_column ?? null}, ${input.dim_type ?? 'standard'},
           ${input.hierarchy ? JSON.stringify(input.hierarchy) : null},
           ${input.description ?? null}, ${now})
        RETURNING *
      `;
      return this.mapDimension(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Dimension '${input.name}' already exists in this model`);
      }
      throw err;
    }
  }

  async listDimensions(sql: Sql, modelId: string): Promise<Dimension[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.dimensions WHERE model_id = ${modelId} ORDER BY name ASC
    `;
    return rows.map((r) => this.mapDimension(r));
  }

  async deleteDimension(sql: Sql, dimensionId: string): Promise<void> {
    await sql`DELETE FROM mod_semantic.dimensions WHERE id = ${dimensionId}`;
  }

  /* ═══════════════════════════════════════════
   * FACT OPERATIONS
   * ═══════════════════════════════════════════ */

  async defineFact(sql: Sql, tenantId: string, input: DefineFactInput): Promise<Fact> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_semantic.facts
          (id, model_id, tenant_id, name, expression, aggregation, format, description, created_at)
        VALUES
          (${id}, ${input.model_id}, ${tenantId}, ${input.name},
           ${input.expression}, ${input.aggregation ?? 'sum'},
           ${input.format ?? 'number'}, ${input.description ?? null}, ${now})
        RETURNING *
      `;
      return this.mapFact(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Fact '${input.name}' already exists in this model`);
      }
      throw err;
    }
  }

  async listFacts(sql: Sql, modelId: string): Promise<Fact[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.facts WHERE model_id = ${modelId} ORDER BY name ASC
    `;
    return rows.map((r) => this.mapFact(r));
  }

  async deleteFact(sql: Sql, factId: string): Promise<void> {
    await sql`DELETE FROM mod_semantic.facts WHERE id = ${factId}`;
  }

  /* ═══════════════════════════════════════════
   * RELATIONSHIP OPERATIONS
   * ═══════════════════════════════════════════ */

  async createRelationship(sql: Sql, tenantId: string, input: CreateRelationshipInput): Promise<Relationship> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const [row] = await sql`
      INSERT INTO mod_semantic.relationships
        (id, model_id, tenant_id, source_dimension_id, target_dimension_id, rel_type, join_expression, created_at)
      VALUES
        (${id}, ${input.model_id}, ${tenantId}, ${input.source_dimension_id},
         ${input.target_dimension_id}, ${input.rel_type ?? 'one_to_many'},
         ${input.join_expression ?? null}, ${now})
      RETURNING *
    `;
    return this.mapRelationship(row);
  }

  async listRelationships(sql: Sql, modelId: string): Promise<Relationship[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.relationships WHERE model_id = ${modelId} ORDER BY created_at ASC
    `;
    return rows.map((r) => this.mapRelationship(r));
  }

  async deleteRelationship(sql: Sql, relationshipId: string): Promise<void> {
    await sql`DELETE FROM mod_semantic.relationships WHERE id = ${relationshipId}`;
  }

  /* ═══════════════════════════════════════════
   * KPI OPERATIONS
   * ═══════════════════════════════════════════ */

  async createKpi(sql: Sql, tenantId: string, userId: string, input: CreateKpiInput): Promise<Kpi> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_semantic.kpis
          (id, tenant_id, model_id, name, description, formula, dimensions,
           target_value, threshold_warning, threshold_critical,
           version, status, created_by, created_at, updated_at)
        VALUES
          (${id}, ${tenantId}, ${input.model_id ?? null}, ${input.name},
           ${input.description ?? null}, ${input.formula},
           ${JSON.stringify(input.dimensions ?? [])},
           ${input.target_value ?? null}, ${input.threshold_warning ?? null},
           ${input.threshold_critical ?? null},
           ${1}, 'draft', ${userId}, ${now}, ${now})
        RETURNING *
      `;
      // Create initial version record
      const versionId = uuidv7();
      await sql`
        INSERT INTO mod_semantic.kpi_versions
          (id, kpi_id, tenant_id, version, formula, dimensions,
           target_value, threshold_warning, threshold_critical,
           change_reason, changed_by, changed_at)
        VALUES
          (${versionId}, ${id}, ${tenantId}, ${1}, ${input.formula},
           ${JSON.stringify(input.dimensions ?? [])},
           ${input.target_value ?? null}, ${input.threshold_warning ?? null},
           ${input.threshold_critical ?? null},
           'Initial creation', ${userId}, ${now})
      `;
      return this.mapKpi(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`KPI with name '${input.name}' already exists`);
      }
      throw err;
    }
  }

  async getKpi(sql: Sql, kpiId: string): Promise<Kpi | null> {
    const [row] = await sql`SELECT * FROM mod_semantic.kpis WHERE id = ${kpiId}`;
    return row ? this.mapKpi(row) : null;
  }

  async listKpis(sql: Sql, tenantId: string): Promise<Kpi[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.kpis WHERE tenant_id = ${tenantId} ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapKpi(r));
  }

  async updateKpi(sql: Sql, userId: string, input: UpdateKpiInput): Promise<Kpi> {
    const kpi = await this.getKpi(sql, input.id);
    if (!kpi) throw new NotFoundError('KPI not found');

    const now = new Date().toISOString();
    const newVersion = kpi.version + 1;
    const newFormula = input.formula ?? kpi.formula;
    const newDimensions = input.dimensions ?? kpi.dimensions;
    const newTarget = input.target_value !== undefined ? input.target_value : kpi.target_value;
    const newWarning = input.threshold_warning !== undefined ? input.threshold_warning : kpi.threshold_warning;
    const newCritical = input.threshold_critical !== undefined ? input.threshold_critical : kpi.threshold_critical;

    const [row] = await sql`
      UPDATE mod_semantic.kpis SET
        name                = COALESCE(${input.name ?? null}, name),
        description         = COALESCE(${input.description ?? null}, description),
        formula             = ${newFormula},
        dimensions          = ${JSON.stringify(newDimensions)},
        target_value        = ${newTarget},
        threshold_warning   = ${newWarning},
        threshold_critical  = ${newCritical},
        version             = ${newVersion},
        status              = 'draft',
        updated_at          = ${now}
      WHERE id = ${input.id}
      RETURNING *
    `;

    // Create version record
    const versionId = uuidv7();
    await sql`
      INSERT INTO mod_semantic.kpi_versions
        (id, kpi_id, tenant_id, version, formula, dimensions,
         target_value, threshold_warning, threshold_critical,
         change_reason, changed_by, changed_at)
      VALUES
        (${versionId}, ${input.id}, ${kpi.tenant_id}, ${newVersion}, ${newFormula},
         ${JSON.stringify(newDimensions)},
         ${newTarget}, ${newWarning}, ${newCritical},
         ${input.change_reason ?? null}, ${userId}, ${now})
    `;

    return this.mapKpi(row);
  }

  async approveKpi(sql: Sql, kpiId: string, userId: string): Promise<Kpi> {
    const kpi = await this.getKpi(sql, kpiId);
    if (!kpi) throw new NotFoundError('KPI not found');
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_semantic.kpis SET
        status      = 'approved',
        approved_by = ${userId},
        approved_at = ${now},
        updated_at  = ${now}
      WHERE id = ${kpiId}
      RETURNING *
    `;
    return this.mapKpi(row);
  }

  async deprecateKpi(sql: Sql, kpiId: string): Promise<Kpi> {
    const kpi = await this.getKpi(sql, kpiId);
    if (!kpi) throw new NotFoundError('KPI not found');
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_semantic.kpis SET
        status     = 'deprecated',
        updated_at = ${now}
      WHERE id = ${kpiId}
      RETURNING *
    `;
    return this.mapKpi(row);
  }

  /* ═══════════════════════════════════════════
   * KPI VERSIONS
   * ═══════════════════════════════════════════ */

  async getKpiVersions(sql: Sql, kpiId: string): Promise<KpiVersion[]> {
    const rows = await sql`
      SELECT * FROM mod_semantic.kpi_versions WHERE kpi_id = ${kpiId} ORDER BY version DESC
    `;
    return rows.map((r) => this.mapKpiVersion(r));
  }

  /* ═══════════════════════════════════════════
   * IMPACT PREVIEW (simulated)
   * ═══════════════════════════════════════════ */

  async previewImpact(sql: Sql, kpiId: string): Promise<ImpactPreviewResult> {
    const kpi = await this.getKpi(sql, kpiId);
    if (!kpi) throw new NotFoundError('KPI not found');

    const versions = await this.getKpiVersions(sql, kpiId);

    // Simulated: no cross-module DB access
    // In production, this would query mod_dashboard for dependent widgets
    return {
      kpi_id: kpi.id,
      kpi_name: kpi.name,
      current_version: kpi.version,
      dependent_dashboards: 0,
      dependent_kpis: [],
      version_history_count: versions.length,
    };
  }

  /* ═══════════════════════════════════════════
   * MAPPERS
   * ═══════════════════════════════════════════ */

  private mapModel(row: Record<string, unknown>): SemanticModel {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | null,
      version: Number(row.version),
      status: row.status as SemanticModel['status'],
      created_by: row.created_by as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapDimension(row: Record<string, unknown>): Dimension {
    return {
      id: row.id as string,
      model_id: row.model_id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      source_column: row.source_column as string | null,
      dim_type: row.dim_type as Dimension['dim_type'],
      hierarchy: typeof row.hierarchy === 'string' ? JSON.parse(row.hierarchy) : (row.hierarchy as Record<string, unknown> | null),
      description: row.description as string | null,
      created_at: String(row.created_at),
    };
  }

  private mapFact(row: Record<string, unknown>): Fact {
    return {
      id: row.id as string,
      model_id: row.model_id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      expression: row.expression as string,
      aggregation: row.aggregation as Fact['aggregation'],
      format: row.format as string,
      description: row.description as string | null,
      created_at: String(row.created_at),
    };
  }

  private mapRelationship(row: Record<string, unknown>): Relationship {
    return {
      id: row.id as string,
      model_id: row.model_id as string,
      tenant_id: row.tenant_id as string,
      source_dimension_id: row.source_dimension_id as string,
      target_dimension_id: row.target_dimension_id as string,
      rel_type: row.rel_type as Relationship['rel_type'],
      join_expression: row.join_expression as string | null,
      created_at: String(row.created_at),
    };
  }

  private mapKpi(row: Record<string, unknown>): Kpi {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      model_id: row.model_id as string | null,
      name: row.name as string,
      description: row.description as string | null,
      formula: row.formula as string,
      dimensions: typeof row.dimensions === 'string' ? JSON.parse(row.dimensions) : (row.dimensions as string[] || []),
      target_value: row.target_value !== null ? Number(row.target_value) : null,
      threshold_warning: row.threshold_warning !== null ? Number(row.threshold_warning) : null,
      threshold_critical: row.threshold_critical !== null ? Number(row.threshold_critical) : null,
      version: Number(row.version),
      status: row.status as Kpi['status'],
      approved_by: row.approved_by as string | null,
      approved_at: row.approved_at ? String(row.approved_at) : null,
      created_by: row.created_by as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapKpiVersion(row: Record<string, unknown>): KpiVersion {
    return {
      id: row.id as string,
      kpi_id: row.kpi_id as string,
      tenant_id: row.tenant_id as string,
      version: Number(row.version),
      formula: row.formula as string,
      dimensions: typeof row.dimensions === 'string' ? JSON.parse(row.dimensions) : (row.dimensions as string[] || []),
      target_value: row.target_value !== null ? Number(row.target_value) : null,
      threshold_warning: row.threshold_warning !== null ? Number(row.threshold_warning) : null,
      threshold_critical: row.threshold_critical !== null ? Number(row.threshold_critical) : null,
      change_reason: row.change_reason as string | null,
      changed_by: row.changed_by as string,
      changed_at: String(row.changed_at),
    };
  }
}
