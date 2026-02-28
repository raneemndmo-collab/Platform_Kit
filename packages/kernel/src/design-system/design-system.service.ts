/** K9 — Design System service (Phase 1) */

import type { Sql } from 'postgres';
import { randomUUID } from 'crypto';
import type { IDesignSystem } from './design-system.interface.js';
import type {
  DesignToken,
  Theme,
  ComponentDef,
  CreateTokenInput,
  UpdateTokenInput,
  CreateThemeInput,
  UpdateThemeInput,
  CreateComponentInput,
  UpdateComponentInput,
  ResolvedTheme,
} from './design-system.types.js';
import { NotFoundError, ConflictError } from '@rasid/shared';

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? '');
}

function toToken(row: Record<string, unknown>): DesignToken {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    category: String(row.category) as DesignToken['category'],
    value: String(row.value),
    description: row.description ? String(row.description) : null,
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toTheme(row: Record<string, unknown>): Theme {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    display_name: String(row.display_name),
    description: row.description ? String(row.description) : null,
    status: String(row.status) as Theme['status'],
    is_default: Boolean(row.is_default),
    token_overrides: (row.token_overrides ?? {}) as Record<string, string>,
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toComponent(row: Record<string, unknown>): ComponentDef {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    display_name: String(row.display_name),
    description: row.description ? String(row.description) : null,
    category: String(row.category),
    status: String(row.status) as ComponentDef['status'],
    variants: (row.variants ?? {}) as Record<string, unknown>,
    default_props: (row.default_props ?? {}) as Record<string, unknown>,
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export class DesignSystemService implements IDesignSystem {

  // ═══════════════════════════════════════════════
  // ─── Tokens ───
  // ═══════════════════════════════════════════════

  async createToken(sql: Sql, tenantId: string, userId: string, input: CreateTokenInput): Promise<DesignToken> {
    const existing = await sql`
      SELECT id FROM kernel.design_tokens WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Token "${input.name}" already exists`);

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.design_tokens (id, tenant_id, name, category, value, description, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.category}, ${input.value}, ${input.description ?? null}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert token');
    return toToken(row);
  }

  async getToken(sql: Sql, id: string): Promise<DesignToken | null> {
    const rows = await sql`SELECT * FROM kernel.design_tokens WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toToken(row);
  }

  async listTokens(sql: Sql, _tenantId: string, category?: string): Promise<DesignToken[]> {
    if (category) {
      const rows = await sql`
        SELECT * FROM kernel.design_tokens WHERE category = ${category} ORDER BY name ASC
      `;
      return rows.map(toToken);
    }
    const rows = await sql`SELECT * FROM kernel.design_tokens ORDER BY category ASC, name ASC`;
    return rows.map(toToken);
  }

  async updateToken(sql: Sql, id: string, input: UpdateTokenInput): Promise<DesignToken> {
    const existing = await sql`SELECT * FROM kernel.design_tokens WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Token not found');

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.design_tokens SET
        value = COALESCE(${input.value ?? null}, value),
        description = COALESCE(${input.description ?? null}, description),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Token not found');
    return toToken(row);
  }

  async deleteToken(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.design_tokens WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Token not found');
    await sql`DELETE FROM kernel.design_tokens WHERE id = ${id}`;
  }

  // ═══════════════════════════════════════════════
  // ─── Themes ───
  // ═══════════════════════════════════════════════

  async createTheme(sql: Sql, tenantId: string, userId: string, input: CreateThemeInput): Promise<Theme> {
    const existing = await sql`
      SELECT id FROM kernel.design_themes WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Theme "${input.name}" already exists`);

    // If this theme is set as default, unset any existing default
    if (input.is_default) {
      await sql`
        UPDATE kernel.design_themes SET is_default = false, updated_at = ${new Date().toISOString()}
        WHERE tenant_id = ${tenantId} AND is_default = true
      `;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.design_themes (id, tenant_id, name, display_name, description, status, is_default, token_overrides, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.display_name}, ${input.description ?? null}, 'draft', ${input.is_default ?? false}, ${JSON.stringify(input.token_overrides ?? {})}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert theme');
    return toTheme(row);
  }

  async getTheme(sql: Sql, id: string): Promise<Theme | null> {
    const rows = await sql`SELECT * FROM kernel.design_themes WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toTheme(row);
  }

  async listThemes(sql: Sql, _tenantId: string, status?: string): Promise<Theme[]> {
    if (status) {
      const rows = await sql`
        SELECT * FROM kernel.design_themes WHERE status = ${status} ORDER BY created_at DESC
      `;
      return rows.map(toTheme);
    }
    const rows = await sql`SELECT * FROM kernel.design_themes ORDER BY created_at DESC`;
    return rows.map(toTheme);
  }

  async updateTheme(sql: Sql, id: string, input: UpdateThemeInput): Promise<Theme> {
    const existing = await sql`SELECT * FROM kernel.design_themes WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Theme not found');

    const currentTheme = existing[0]!;

    // If setting as default, unset any existing default
    if (input.is_default === true) {
      await sql`
        UPDATE kernel.design_themes SET is_default = false, updated_at = ${new Date().toISOString()}
        WHERE tenant_id = ${String(currentTheme.tenant_id)} AND is_default = true AND id != ${id}
      `;
    }

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.design_themes SET
        display_name = COALESCE(${input.display_name ?? null}, display_name),
        description = COALESCE(${input.description ?? null}, description),
        status = COALESCE(${input.status ?? null}, status),
        is_default = COALESCE(${input.is_default ?? null}, is_default),
        token_overrides = COALESCE(${input.token_overrides ? JSON.stringify(input.token_overrides) : null}::jsonb, token_overrides),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Theme not found');
    return toTheme(row);
  }

  async deleteTheme(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.design_themes WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Theme not found');
    await sql`DELETE FROM kernel.design_themes WHERE id = ${id}`;
  }

  async resolveTheme(sql: Sql, _tenantId: string, themeId: string): Promise<ResolvedTheme> {
    const themeRows = await sql`SELECT * FROM kernel.design_themes WHERE id = ${themeId}`;
    const theme = themeRows[0];
    if (!theme) throw new NotFoundError('Theme not found');

    // Get all base tokens for this tenant
    const tokenRows = await sql`SELECT * FROM kernel.design_tokens ORDER BY name ASC`;
    const baseTokens: Record<string, string> = {};
    for (const row of tokenRows) {
      baseTokens[String(row.name)] = String(row.value);
    }

    // Apply overrides
    const overrides = (theme.token_overrides ?? {}) as Record<string, string>;
    const resolved = { ...baseTokens, ...overrides };

    return {
      theme_id: String(theme.id),
      theme_name: String(theme.name),
      tokens: resolved,
    };
  }

  // ═══════════════════════════════════════════════
  // ─── Components ───
  // ═══════════════════════════════════════════════

  async createComponent(sql: Sql, tenantId: string, userId: string, input: CreateComponentInput): Promise<ComponentDef> {
    const existing = await sql`
      SELECT id FROM kernel.design_components WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Component "${input.name}" already exists`);

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.design_components (id, tenant_id, name, display_name, description, category, status, variants, default_props, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.display_name}, ${input.description ?? null}, ${input.category}, 'draft', ${JSON.stringify(input.variants ?? {})}, ${JSON.stringify(input.default_props ?? {})}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert component');
    return toComponent(row);
  }

  async getComponent(sql: Sql, id: string): Promise<ComponentDef | null> {
    const rows = await sql`SELECT * FROM kernel.design_components WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toComponent(row);
  }

  async listComponents(sql: Sql, _tenantId: string, category?: string): Promise<ComponentDef[]> {
    if (category) {
      const rows = await sql`
        SELECT * FROM kernel.design_components WHERE category = ${category} ORDER BY name ASC
      `;
      return rows.map(toComponent);
    }
    const rows = await sql`SELECT * FROM kernel.design_components ORDER BY category ASC, name ASC`;
    return rows.map(toComponent);
  }

  async updateComponent(sql: Sql, id: string, input: UpdateComponentInput): Promise<ComponentDef> {
    const existing = await sql`SELECT * FROM kernel.design_components WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Component not found');

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.design_components SET
        display_name = COALESCE(${input.display_name ?? null}, display_name),
        description = COALESCE(${input.description ?? null}, description),
        category = COALESCE(${input.category ?? null}, category),
        status = COALESCE(${input.status ?? null}, status),
        variants = COALESCE(${input.variants ? JSON.stringify(input.variants) : null}::jsonb, variants),
        default_props = COALESCE(${input.default_props ? JSON.stringify(input.default_props) : null}::jsonb, default_props),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Component not found');
    return toComponent(row);
  }

  async deleteComponent(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.design_components WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Component not found');
    await sql`DELETE FROM kernel.design_components WHERE id = ${id}`;
  }
}
