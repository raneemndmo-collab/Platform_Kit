/** K9 — Design System types (Phase 1) */

export type TokenCategory = 'color' | 'typography' | 'spacing' | 'sizing' | 'border' | 'shadow' | 'opacity';
export type ThemeStatus = 'draft' | 'active' | 'archived';
export type ComponentStatus = 'draft' | 'active' | 'deprecated';

export interface DesignToken {
  id: string;
  tenant_id: string;
  name: string;
  category: TokenCategory;
  value: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string | null;
  status: ThemeStatus;
  is_default: boolean;
  token_overrides: Record<string, string>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComponentDef {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  status: ComponentStatus;
  variants: Record<string, unknown>;
  default_props: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Input types ───

export interface CreateTokenInput {
  name: string;
  category: TokenCategory;
  value: string;
  description?: string;
}

export interface UpdateTokenInput {
  value?: string;
  description?: string;
}

export interface CreateThemeInput {
  name: string;
  display_name: string;
  description?: string;
  is_default?: boolean;
  token_overrides?: Record<string, string>;
}

export interface UpdateThemeInput {
  display_name?: string;
  description?: string;
  status?: ThemeStatus;
  is_default?: boolean;
  token_overrides?: Record<string, string>;
}

export interface CreateComponentInput {
  name: string;
  display_name: string;
  description?: string;
  category: string;
  variants?: Record<string, unknown>;
  default_props?: Record<string, unknown>;
}

export interface UpdateComponentInput {
  display_name?: string;
  description?: string;
  category?: string;
  status?: ComponentStatus;
  variants?: Record<string, unknown>;
  default_props?: Record<string, unknown>;
}

export interface ResolvedTheme {
  theme_id: string;
  theme_name: string;
  tokens: Record<string, string>;
}
