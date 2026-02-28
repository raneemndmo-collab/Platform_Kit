import type postgres from 'postgres';
import type {
  Dashboard, Widget, SharedDashboard, WidgetQueryResult,
  CreateDashboardInput, UpdateDashboardInput,
  AddWidgetInput, UpdateWidgetInput, ShareDashboardInput,
} from './dashboard.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface DashboardServiceInterface {
  // Dashboard CRUD
  listDashboards(sql: Sql, tenantId: string): Promise<Dashboard[]>;
  getDashboard(sql: Sql, tenantId: string, id: string): Promise<Dashboard | null>;
  createDashboard(sql: Sql, tenantId: string, userId: string, input: CreateDashboardInput): Promise<Dashboard>;
  updateDashboard(sql: Sql, tenantId: string, id: string, input: UpdateDashboardInput): Promise<Dashboard>;
  deleteDashboard(sql: Sql, tenantId: string, id: string): Promise<void>;
  publishDashboard(sql: Sql, tenantId: string, id: string): Promise<Dashboard>;

  // Widget CRUD
  listWidgets(sql: Sql, tenantId: string, dashboardId: string): Promise<Widget[]>;
  getWidget(sql: Sql, tenantId: string, widgetId: string): Promise<Widget | null>;
  addWidget(sql: Sql, tenantId: string, dashboardId: string, input: AddWidgetInput): Promise<Widget>;
  updateWidget(sql: Sql, tenantId: string, widgetId: string, input: UpdateWidgetInput): Promise<Widget>;
  removeWidget(sql: Sql, tenantId: string, widgetId: string): Promise<void>;

  // Widget data query (via semantic layer metadata only)
  queryWidgetData(sql: Sql, tenantId: string, widgetId: string): Promise<WidgetQueryResult>;

  // Sharing
  shareDashboard(sql: Sql, tenantId: string, dashboardId: string, input: ShareDashboardInput): Promise<SharedDashboard>;
  listShares(sql: Sql, tenantId: string, dashboardId: string): Promise<SharedDashboard[]>;
  removeShare(sql: Sql, tenantId: string, shareId: string): Promise<void>;
}
