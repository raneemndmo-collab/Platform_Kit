/**
 * M14 Custom Pages — Service
 *
 * Metadata-only page definitions. No rendering, no templating, no HTML.
 * Sections reference dashboards/reports by ID only (plain string, no FK).
 * All DB access scoped to mod_custom_pages schema.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type { ICustomPagesService } from './custom-pages.interface.js';
import type {
  PageRow, CreatePageInput, UpdatePageInput,
  AddSectionInput, UpdateSectionInput, PageSection,
} from './custom-pages.types.js';

export class CustomPagesService implements ICustomPagesService {

  /* ── helpers ── */

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /* ── Page CRUD ── */

  async createPage(sql: postgres.ReservedSql, tenantId: string, createdBy: string, input: CreatePageInput): Promise<PageRow> {
    const id = uuidv7();
    const slug = input.slug || this.toSlug(input.name);
    const sections = (input.sections || []).map((s, i) => ({
      ...s,
      id: uuidv7(),
      order: s.order ?? i,
      config: s.config || {},
    }));
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_custom_pages.pages
        (id, tenant_id, name, slug, description, icon, status, layout, sections, created_by, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${input.name}, ${slug}, ${input.description || null},
         ${input.icon || null}, 'draft', ${JSON.stringify(input.layout || {})},
         ${JSON.stringify(sections)}, ${createdBy}, ${now}, ${now})
      RETURNING *`;
    return this.mapRow(rows[0]);
  }

  async listPages(sql: postgres.ReservedSql, tenantId: string): Promise<PageRow[]> {
    const rows = await sql`
      SELECT * FROM mod_custom_pages.pages
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC`;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getPage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null> {
    const rows = await sql`
      SELECT * FROM mod_custom_pages.pages
      WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async updatePage(sql: postgres.ReservedSql, tenantId: string, id: string, input: UpdatePageInput): Promise<PageRow | null> {
    const existing = await this.getPage(sql, tenantId, id);
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const slug = input.slug ?? existing.slug;
    const description = input.description !== undefined ? input.description : existing.description;
    const icon = input.icon !== undefined ? input.icon : existing.icon;
    const layout = input.layout ?? existing.layout;
    const sections = input.sections !== undefined
      ? input.sections.map((s, i) => ({ ...s, id: (s as any).id || uuidv7(), order: s.order ?? i, config: s.config || {} }))
      : existing.sections;
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_custom_pages.pages SET
        name = ${name}, slug = ${slug}, description = ${description || null},
        icon = ${icon || null}, layout = ${JSON.stringify(layout)},
        sections = ${JSON.stringify(sections)}, updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async deletePage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM mod_custom_pages.pages
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id`;
    return rows.length > 0;
  }

  /* ── Status transitions ── */

  async publishPage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null> {
    const rows = await sql`
      UPDATE mod_custom_pages.pages SET status = 'published', updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async archivePage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null> {
    const rows = await sql`
      UPDATE mod_custom_pages.pages SET status = 'archived', updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /* ── Section management ── */

  async addSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, input: AddSectionInput): Promise<PageRow | null> {
    const page = await this.getPage(sql, tenantId, pageId);
    if (!page) return null;

    const newSection: PageSection = {
      id: uuidv7(),
      section_type: input.section_type,
      order: input.order ?? page.sections.length,
      reference_id: input.reference_id,
      config: input.config || {},
    };
    const sections = [...page.sections, newSection];
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_custom_pages.pages SET
        sections = ${JSON.stringify(sections)}, updated_at = ${now}
      WHERE id = ${pageId} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async updateSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionId: string, input: UpdateSectionInput): Promise<PageRow | null> {
    const page = await this.getPage(sql, tenantId, pageId);
    if (!page) return null;

    const idx = page.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return null;

    const updated = { ...page.sections[idx] };
    if (input.order !== undefined) updated.order = input.order;
    if (input.reference_id !== undefined) updated.reference_id = input.reference_id;
    if (input.config !== undefined) updated.config = input.config;

    const sections = [...page.sections];
    sections[idx] = updated;
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_custom_pages.pages SET
        sections = ${JSON.stringify(sections)}, updated_at = ${now}
      WHERE id = ${pageId} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async removeSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionId: string): Promise<PageRow | null> {
    const page = await this.getPage(sql, tenantId, pageId);
    if (!page) return null;

    const sections = page.sections.filter((s) => s.id !== sectionId);
    if (sections.length === page.sections.length) return null; // not found
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_custom_pages.pages SET
        sections = ${JSON.stringify(sections)}, updated_at = ${now}
      WHERE id = ${pageId} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async reorderSections(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionIds: string[]): Promise<PageRow | null> {
    const page = await this.getPage(sql, tenantId, pageId);
    if (!page) return null;

    const sectionMap = new Map(page.sections.map((s) => [s.id, s]));
    const reordered: PageSection[] = [];
    for (let i = 0; i < sectionIds.length; i++) {
      const s = sectionMap.get(sectionIds[i]);
      if (!s) return null; // invalid section ID
      reordered.push({ ...s, order: i });
    }
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_custom_pages.pages SET
        sections = ${JSON.stringify(reordered)}, updated_at = ${now}
      WHERE id = ${pageId} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /* ── Row mapper ── */

  private mapRow(r: any): PageRow {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      icon: r.icon,
      status: r.status,
      layout: typeof r.layout === 'string' ? JSON.parse(r.layout) : r.layout,
      sections: typeof r.sections === 'string' ? JSON.parse(r.sections) : (r.sections || []),
      created_by: r.created_by,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    };
  }
}
