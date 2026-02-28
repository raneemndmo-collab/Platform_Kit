/** K9 — Design System interface (Phase 1) */

import type { Sql } from 'postgres';
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

export interface IDesignSystem {
  // ─── Tokens ───
  createToken(sql: Sql, tenantId: string, userId: string, input: CreateTokenInput): Promise<DesignToken>;
  getToken(sql: Sql, id: string): Promise<DesignToken | null>;
  listTokens(sql: Sql, tenantId: string, category?: string): Promise<DesignToken[]>;
  updateToken(sql: Sql, id: string, input: UpdateTokenInput): Promise<DesignToken>;
  deleteToken(sql: Sql, id: string): Promise<void>;

  // ─── Themes ───
  createTheme(sql: Sql, tenantId: string, userId: string, input: CreateThemeInput): Promise<Theme>;
  getTheme(sql: Sql, id: string): Promise<Theme | null>;
  listThemes(sql: Sql, tenantId: string, status?: string): Promise<Theme[]>;
  updateTheme(sql: Sql, id: string, input: UpdateThemeInput): Promise<Theme>;
  deleteTheme(sql: Sql, id: string): Promise<void>;
  resolveTheme(sql: Sql, tenantId: string, themeId: string): Promise<ResolvedTheme>;

  // ─── Components ───
  createComponent(sql: Sql, tenantId: string, userId: string, input: CreateComponentInput): Promise<ComponentDef>;
  getComponent(sql: Sql, id: string): Promise<ComponentDef | null>;
  listComponents(sql: Sql, tenantId: string, category?: string): Promise<ComponentDef[]>;
  updateComponent(sql: Sql, id: string, input: UpdateComponentInput): Promise<ComponentDef>;
  deleteComponent(sql: Sql, id: string): Promise<void>;
}
