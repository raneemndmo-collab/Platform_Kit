/**
 * M21 AI Engine — Tool Registry Service (Step 2)
 *
 * Manages AI tool definitions and action bindings.
 * Tool definitions wrap K3 Action Manifests with AI-specific metadata.
 * Tool bindings map tool inputs/outputs to action parameters.
 * Schema: mod_ai
 * No direct DB access to other module schemas.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  ToolDefinition,
  ToolBinding,
  CreateToolDefinitionInput,
  UpdateToolDefinitionInput,
  CreateToolBindingInput,
  ToolCategory,
  ToolStatus,
  ToolExample,
} from './tool-registry.types.js';
import { NotFoundError, ValidationError } from '@rasid/shared';
import { actionRegistry } from '../../../kernel/src/index.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class ToolRegistryService {
  // ─────────── Tool Definitions CRUD ───────────

  async createToolDefinition(
    sql: Sql, tenantId: string,
    input: CreateToolDefinitionInput,
  ): Promise<ToolDefinition> {
    // Verify the action exists in the K3 registry
    const manifest = actionRegistry.getManifest(input.action_id);
    if (!manifest) {
      throw new ValidationError(
        `Action '${input.action_id}' not found in registry`,
      );
    }

    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.tool_definitions
        (id, tenant_id, action_id, name, description, category,
         status, parameter_schema, output_description,
         examples, tags, requires_confirmation,
         created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.action_id},
        ${input.name}, ${input.description},
        ${input.category || 'general'},
        'enabled',
        ${JSON.stringify(input.parameter_schema || manifest.input_schema)}::jsonb,
        ${input.output_description || ''},
        ${JSON.stringify(input.examples || [])}::jsonb,
        ${JSON.stringify(input.tags || [])}::jsonb,
        ${input.requires_confirmation ?? manifest.sensitivity !== 'low'},
        ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapToolDefinition(rows[0]);
  }

  async listToolDefinitions(
    sql: Sql, tenantId: string,
    filter?: { category?: string; status?: string; tag?: string },
  ): Promise<ToolDefinition[]> {
    let rows;
    if (filter?.category && filter?.status) {
      rows = await sql`
        SELECT * FROM mod_ai.tool_definitions
        WHERE tenant_id = ${tenantId}
          AND category = ${filter.category}
          AND status = ${filter.status}
        ORDER BY name ASC
      `;
    } else if (filter?.category) {
      rows = await sql`
        SELECT * FROM mod_ai.tool_definitions
        WHERE tenant_id = ${tenantId}
          AND category = ${filter.category}
        ORDER BY name ASC
      `;
    } else if (filter?.status) {
      rows = await sql`
        SELECT * FROM mod_ai.tool_definitions
        WHERE tenant_id = ${tenantId}
          AND status = ${filter.status}
        ORDER BY name ASC
      `;
    } else {
      rows = await sql`
        SELECT * FROM mod_ai.tool_definitions
        WHERE tenant_id = ${tenantId}
        ORDER BY name ASC
      `;
    }

    let result = rows.map(this.mapToolDefinition);

    // Filter by tag in application layer (JSONB contains)
    if (filter?.tag) {
      result = result.filter((t) => t.tags.includes(filter.tag!));
    }

    return result;
  }

  async getToolDefinition(
    sql: Sql, tenantId: string, toolId: string,
  ): Promise<ToolDefinition | null> {
    const rows = await sql`
      SELECT * FROM mod_ai.tool_definitions
      WHERE id = ${toolId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapToolDefinition(rows[0]) : null;
  }

  async getToolByActionId(
    sql: Sql, tenantId: string, actionId: string,
  ): Promise<ToolDefinition | null> {
    const rows = await sql`
      SELECT * FROM mod_ai.tool_definitions
      WHERE action_id = ${actionId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapToolDefinition(rows[0]) : null;
  }

  async updateToolDefinition(
    sql: Sql, tenantId: string, toolId: string,
    input: UpdateToolDefinitionInput,
  ): Promise<ToolDefinition> {
    const existing = await this.getToolDefinition(sql, tenantId, toolId);
    if (!existing) {
      throw new NotFoundError(`Tool definition ${toolId} not found`);
    }
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE mod_ai.tool_definitions SET
        name = ${input.name ?? existing.name},
        description = ${input.description ?? existing.description},
        category = ${input.category ?? existing.category},
        status = ${input.status ?? existing.status},
        parameter_schema = ${JSON.stringify(
          input.parameter_schema ?? existing.parameter_schema,
        )}::jsonb,
        output_description = ${input.output_description ?? existing.output_description},
        examples = ${JSON.stringify(input.examples ?? existing.examples)}::jsonb,
        tags = ${JSON.stringify(input.tags ?? existing.tags)}::jsonb,
        requires_confirmation = ${input.requires_confirmation ?? existing.requires_confirmation},
        updated_at = ${now}
      WHERE id = ${toolId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapToolDefinition(rows[0]);
  }

  async deleteToolDefinition(
    sql: Sql, tenantId: string, toolId: string,
  ): Promise<void> {
    const existing = await this.getToolDefinition(sql, tenantId, toolId);
    if (!existing) {
      throw new NotFoundError(`Tool definition ${toolId} not found`);
    }
    await sql`
      DELETE FROM mod_ai.tool_definitions
      WHERE id = ${toolId} AND tenant_id = ${tenantId}
    `;
  }

  // ─────────── Tool Bindings CRUD ───────────

  async createToolBinding(
    sql: Sql, tenantId: string,
    input: CreateToolBindingInput,
  ): Promise<ToolBinding> {
    // Verify tool exists
    const tool = await this.getToolDefinition(sql, tenantId, input.tool_id);
    if (!tool) {
      throw new NotFoundError(`Tool definition ${input.tool_id} not found`);
    }
    // Verify target action exists
    const manifest = actionRegistry.getManifest(input.action_id);
    if (!manifest) {
      throw new ValidationError(
        `Action '${input.action_id}' not found in registry`,
      );
    }

    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_ai.tool_bindings
        (id, tenant_id, tool_id, action_id,
         input_mapping, output_mapping, pre_conditions, created_at)
      VALUES (
        ${id}, ${tenantId}, ${input.tool_id}, ${input.action_id},
        ${JSON.stringify(input.input_mapping || {})}::jsonb,
        ${JSON.stringify(input.output_mapping || {})}::jsonb,
        ${JSON.stringify(input.pre_conditions || {})}::jsonb,
        ${now}
      )
      RETURNING *
    `;
    return this.mapToolBinding(rows[0]);
  }

  async listToolBindings(
    sql: Sql, tenantId: string, toolId?: string,
  ): Promise<ToolBinding[]> {
    if (toolId) {
      const rows = await sql`
        SELECT * FROM mod_ai.tool_bindings
        WHERE tenant_id = ${tenantId} AND tool_id = ${toolId}
        ORDER BY created_at ASC
      `;
      return rows.map(this.mapToolBinding);
    }
    const rows = await sql`
      SELECT * FROM mod_ai.tool_bindings
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
    return rows.map(this.mapToolBinding);
  }

  async deleteToolBinding(
    sql: Sql, tenantId: string, bindingId: string,
  ): Promise<void> {
    const rows = await sql`
      SELECT id FROM mod_ai.tool_bindings
      WHERE id = ${bindingId} AND tenant_id = ${tenantId}
    `;
    if (!rows.length) {
      throw new NotFoundError(`Tool binding ${bindingId} not found`);
    }
    await sql`
      DELETE FROM mod_ai.tool_bindings
      WHERE id = ${bindingId} AND tenant_id = ${tenantId}
    `;
  }

  // ─────────── Auto-sync from Action Registry ───────────

  async syncFromRegistry(
    sql: Sql, tenantId: string,
  ): Promise<{ created: number; updated: number }> {
    const allActions = actionRegistry.listActions();
    let created = 0;
    let updated = 0;

    for (const manifest of allActions) {
      const existing = await this.getToolByActionId(
        sql, tenantId, manifest.action_id,
      );
      if (!existing) {
        await this.createToolDefinition(sql, tenantId, {
          action_id: manifest.action_id,
          name: manifest.display_name,
          description: `${manifest.display_name} (${manifest.module_id})`,
          category: this.inferCategory(manifest.module_id),
          parameter_schema: manifest.input_schema,
          tags: [manifest.module_id, manifest.verb, manifest.resource],
        });
        created++;
      } else {
        // Update name/description if changed
        if (existing.name !== manifest.display_name) {
          await this.updateToolDefinition(sql, tenantId, existing.id, {
            name: manifest.display_name,
          });
          updated++;
        }
      }
    }

    return { created, updated };
  }

  // ─────────── Helpers ───────────

  private inferCategory(moduleId: string): ToolCategory {
    const map: Record<string, ToolCategory> = {
      kernel: 'administration',
      mod_connectors: 'data_management',
      mod_sheetforge: 'data_management',
      mod_semantic: 'analytics',
      mod_search: 'analytics',
      mod_dashboard: 'analytics',
      mod_file_manager: 'content',
      mod_reports: 'content',
      mod_custom_pages: 'content',
      mod_presentations: 'content',
      mod_forms: 'content',
      mod_ai: 'ai',
      mod_observability: 'administration',
      mod_backup: 'administration',
      mod_gateway: 'administration',
      mod_billing: 'administration',
      mod_l10n: 'content',
      mod_portal: 'administration',
    };
    return map[moduleId] || 'general';
  }

  private mapToolDefinition(
    row: Record<string, unknown>,
  ): ToolDefinition {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      action_id: String(row.action_id),
      name: String(row.name),
      description: String(row.description),
      category: String(row.category) as ToolCategory,
      status: String(row.status) as ToolStatus,
      parameter_schema: (row.parameter_schema ?? {}) as Record<string, unknown>,
      output_description: String(row.output_description ?? ''),
      examples: (row.examples ?? []) as ToolExample[],
      tags: (row.tags ?? []) as string[],
      requires_confirmation: Boolean(row.requires_confirmation),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapToolBinding(row: Record<string, unknown>): ToolBinding {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      tool_id: String(row.tool_id),
      action_id: String(row.action_id),
      input_mapping: (row.input_mapping ?? {}) as Record<string, unknown>,
      output_mapping: (row.output_mapping ?? {}) as Record<string, unknown>,
      pre_conditions: (row.pre_conditions ?? {}) as Record<string, unknown>,
      created_at: String(row.created_at),
    };
  }
}

export const toolRegistryService = new ToolRegistryService();
