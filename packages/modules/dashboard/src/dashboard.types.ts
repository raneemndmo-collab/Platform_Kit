export type WidgetType = 'kpi_card' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'table' | 'metric' | 'text';
export type DashboardStatus = 'draft' | 'published' | 'archived';
export type SharedWithType = 'user' | 'role' | 'tenant';
export type PermissionLevel = 'view' | 'edit';

export interface Dashboard {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  layout: unknown[];
  filters: unknown[];
  status: DashboardStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  tenant_id: string;
  title: string;
  widget_type: WidgetType;
  config: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
  data_source: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SharedDashboard {
  id: string;
  dashboard_id: string;
  tenant_id: string;
  shared_with_type: SharedWithType;
  shared_with_id: string;
  permission_level: PermissionLevel;
  created_at: string;
}

export interface WidgetQueryResult {
  widget_id: string;
  widget_type: WidgetType;
  data_source: Record<string, unknown>;
  result: unknown;
  queried_at: string;
}

export interface CreateDashboardInput {
  name: string;
  description?: string;
  layout?: unknown[];
  filters?: unknown[];
}

export interface UpdateDashboardInput {
  name?: string;
  description?: string;
  layout?: unknown[];
  filters?: unknown[];
}

export interface AddWidgetInput {
  title: string;
  widget_type: WidgetType;
  config?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
  data_source?: Record<string, unknown>;
}

export interface UpdateWidgetInput {
  title?: string;
  config?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
  data_source?: Record<string, unknown>;
}

export interface ShareDashboardInput {
  shared_with_type: SharedWithType;
  shared_with_id: string;
  permission_level?: PermissionLevel;
}
