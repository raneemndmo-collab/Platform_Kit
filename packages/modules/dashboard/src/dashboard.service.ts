/**
 * M9 Dashboard Engine -- Service
 *
 * Data operations for dashboards, widgets, sharing.
 * All writes called from K3 action handlers (not directly from routes).
 * Schema: mod_dashboard
 * No direct DB access to other module schemas.
 * Dashboard is read-only consumer of semantic layer -- simulated metadata queries only.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  Dashboard, Widget, SharedDashboard, WidgetQueryResult,
  CreateDashboardInput, UpdateDashboardInput,
  AddWidgetInput, UpdateWidgetInput, ShareDashboardInput,
} from './dashboard.types.js';
import type { DashboardServiceInterface } from './dashboard.interface.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class DashboardService implements DashboardServiceInterface {

  // --------------- Dashboard CRUD ---------------

  async listDashboards(sql: Sql, tenantId: string): Promise<Dashboard[]> {
    const rows = await sql`
      SELECT * FROM mod_dashboard.dashboards
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapDashboard);
  }

  async getDashboard(sql: Sql, tenantId: string, id: string): Promise<Dashboard | null> {
    const rows = await sql`
      SELECT * FROM mod_dashboard.dashboards
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapDashboard(rows[0]) : null;
  }

  async createDashboard(sql: Sql, tenantId: string, userId: string, input: CreateDashboardInput): Promise<Dashboard> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_dashboard.dashboards (id, tenant_id, name, description, layout, filters, status, created_by, created_at, updated_at)
      VALUES (
        ${id}, ${tenantId}, ${input.name}, ${input.description || ''},
        ${JSON.stringify(input.layout || [])}::jsonb,
        ${JSON.stringify(input.filters || [])}::jsonb,
        'draft', ${userId}, ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapDashboard(rows[0]);
  }

  async updateDashboard(sql: Sql, tenantId: string, id: string, input: UpdateDashboardInput): Promise<Dashboard> {
    const existing = await this.getDashboard(sql, tenantId, id);
    if (!existing) throw new Error('Dashboard not found');

    const rows = await sql`
      UPDATE mod_dashboard.dashboards SET
        name = ${input.name ?? existing.name},
        description = ${input.description ?? existing.description},
        layout = ${JSON.stringify(input.layout ?? existing.layout)}::jsonb,
        filters = ${JSON.stringify(input.filters ?? existing.filters)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapDashboard(rows[0]);
  }

  async deleteDashboard(sql: Sql, tenantId: string, id: string): Promise<void> {
    await sql`DELETE FROM mod_dashboard.dashboards WHERE id = ${id} AND tenant_id = ${tenantId}`;
  }

  async publishDashboard(sql: Sql, tenantId: string, id: string): Promise<Dashboard> {
    const rows = await sql`
      UPDATE mod_dashboard.dashboards SET status = 'published', updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Dashboard not found');
    return this.mapDashboard(rows[0]);
  }

  // --------------- Widget CRUD ---------------

  async listWidgets(sql: Sql, tenantId: string, dashboardId: string): Promise<Widget[]> {
    const rows = await sql`
      SELECT * FROM mod_dashboard.widgets
      WHERE dashboard_id = ${dashboardId} AND tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
    return rows.map(this.mapWidget);
  }

  async getWidget(sql: Sql, tenantId: string, widgetId: string): Promise<Widget | null> {
    const rows = await sql`
      SELECT * FROM mod_dashboard.widgets
      WHERE id = ${widgetId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapWidget(rows[0]) : null;
  }

  async addWidget(sql: Sql, tenantId: string, dashboardId: string, input: AddWidgetInput): Promise<Widget> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_dashboard.widgets (id, dashboard_id, tenant_id, title, widget_type, config, position, data_source, created_at, updated_at)
      VALUES (
        ${id}, ${dashboardId}, ${tenantId}, ${input.title}, ${input.widget_type},
        ${JSON.stringify(input.config || {})}::jsonb,
        ${JSON.stringify(input.position || { x: 0, y: 0, w: 4, h: 3 })}::jsonb,
        ${JSON.stringify(input.data_source || {})}::jsonb,
        ${now}, ${now}
      )
      RETURNING *
    `;
    return this.mapWidget(rows[0]);
  }

  async updateWidget(sql: Sql, tenantId: string, widgetId: string, input: UpdateWidgetInput): Promise<Widget> {
    const existing = await this.getWidget(sql, tenantId, widgetId);
    if (!existing) throw new Error('Widget not found');

    const rows = await sql`
      UPDATE mod_dashboard.widgets SET
        title = ${input.title ?? existing.title},
        config = ${JSON.stringify(input.config ?? existing.config)}::jsonb,
        position = ${JSON.stringify(input.position ?? existing.position)}::jsonb,
        data_source = ${JSON.stringify(input.data_source ?? existing.data_source)}::jsonb,
        updated_at = NOW()
      WHERE id = ${widgetId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapWidget(rows[0]);
  }

  async removeWidget(sql: Sql, tenantId: string, widgetId: string): Promise<void> {
    await sql`DELETE FROM mod_dashboard.widgets WHERE id = ${widgetId} AND tenant_id = ${tenantId}`;
  }

  // --------------- Widget Data Query (Semantic Layer metadata only) ---------------

  async queryWidgetData(sql: Sql, tenantId: string, widgetId: string): Promise<WidgetQueryResult> {
    const widget = await this.getWidget(sql, tenantId, widgetId);
    if (!widget) throw new Error('Widget not found');

    // Dashboard is read-only consumer of semantic layer.
    // Query executes against metadata only -- no direct DB access to other modules.
    // data_source contains references like { model_id, kpi_id, dimension, fact, filters }
    // In production, this would call semantic layer API. Here we return simulated metadata-based result.
    const simulatedResult = this.simulateSemanticQuery(widget);

    return {
      widget_id: widget.id,
      widget_type: widget.widget_type,
      data_source: widget.data_source,
      result: simulatedResult,
      queried_at: new Date().toISOString(),
    };
  }

  // --------------- Sharing ---------------

  async shareDashboard(sql: Sql, tenantId: string, dashboardId: string, input: ShareDashboardInput): Promise<SharedDashboard> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_dashboard.shared_dashboards (id, dashboard_id, tenant_id, shared_with_type, shared_with_id, permission_level, created_at)
      VALUES (${id}, ${dashboardId}, ${tenantId}, ${input.shared_with_type}, ${input.shared_with_id}, ${input.permission_level || 'view'}, ${now})
      RETURNING *
    `;
    return this.mapShare(rows[0]);
  }

  async listShares(sql: Sql, tenantId: string, dashboardId: string): Promise<SharedDashboard[]> {
    const rows = await sql`
      SELECT * FROM mod_dashboard.shared_dashboards
      WHERE dashboard_id = ${dashboardId} AND tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;
    return rows.map(this.mapShare);
  }

  async removeShare(sql: Sql, tenantId: string, shareId: string): Promise<void> {
    await sql`DELETE FROM mod_dashboard.shared_dashboards WHERE id = ${shareId} AND tenant_id = ${tenantId}`;
  }

  // --------------- Simulated Semantic Layer Query ---------------

  private simulateSemanticQuery(widget: Widget): unknown {
    // Simulated: returns metadata-based result based on widget type.
    // No cross-schema queries. No direct DB access to mod_semantic or any other module.
    const ds = widget.data_source as Record<string, unknown>;
    switch (widget.widget_type) {
      case 'kpi_card':
        return { value: 0, label: ds.kpi_name || 'KPI', trend: 'stable', source: 'semantic_layer_simulated' };
      case 'bar_chart':
      case 'line_chart':
        return { labels: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Series 1', data: [0, 0, 0, 0] }], source: 'semantic_layer_simulated' };
      case 'pie_chart':
        return { labels: ['A', 'B', 'C'], values: [0, 0, 0], source: 'semantic_layer_simulated' };
      case 'table':
        return { columns: [], rows: [], source: 'semantic_layer_simulated' };
      case 'metric':
        return { value: 0, unit: '', source: 'semantic_layer_simulated' };
      case 'text':
        return { content: ds.content || '', source: 'static' };
      default:
        return { source: 'semantic_layer_simulated' };
    }
  }

  // --------------- Mappers ---------------

  private mapDashboard(row: any): Dashboard {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      name: String(row.name),
      description: String(row.description || ''),
      layout: row.layout ?? [],
      filters: row.filters ?? [],
      status: String(row.status) as any,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapWidget(row: any): Widget {
    return {
      id: String(row.id),
      dashboard_id: String(row.dashboard_id),
      tenant_id: String(row.tenant_id),
      title: String(row.title),
      widget_type: String(row.widget_type) as any,
      config: row.config ?? {},
      position: row.position ?? { x: 0, y: 0, w: 4, h: 3 },
      data_source: row.data_source ?? {},
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapShare(row: any): SharedDashboard {
    return {
      id: String(row.id),
      dashboard_id: String(row.dashboard_id),
      tenant_id: String(row.tenant_id),
      shared_with_type: String(row.shared_with_type) as any,
      shared_with_id: String(row.shared_with_id),
      permission_level: String(row.permission_level) as any,
      created_at: String(row.created_at),
    };
  }
}
