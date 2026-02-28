/**
 * M16 Presentations — Service
 *
 * Metadata-only slide definitions. No PPTX, no PDF, no rendering.
 * Slides stored as JSONB array with title, layout, content (report refs by ID).
 * All DB access scoped to mod_presentations schema.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type { IPresentationsService } from './presentations.interface.js';
import type {
  PresentationRow, CreatePresentationInput, UpdatePresentationInput,
  AddSlideInput, UpdateSlideInput, SlideDefinition,
} from './presentations.types.js';

export class PresentationsService implements IPresentationsService {

  /* ── Presentation CRUD ── */

  async createPresentation(sql: postgres.ReservedSql, tenantId: string, createdBy: string, input: CreatePresentationInput): Promise<PresentationRow> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_presentations.presentations
        (id, tenant_id, name, description, status, slides, created_by, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${input.name}, ${input.description || null},
         'draft', ${JSON.stringify([])}, ${createdBy}, ${now}, ${now})
      RETURNING *`;
    return this.mapRow(rows[0]);
  }

  async listPresentations(sql: postgres.ReservedSql, tenantId: string): Promise<PresentationRow[]> {
    const rows = await sql`
      SELECT * FROM mod_presentations.presentations
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC`;
    return rows.map((r: any) => this.mapRow(r));
  }

  async getPresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null> {
    const rows = await sql`
      SELECT * FROM mod_presentations.presentations
      WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async updatePresentation(sql: postgres.ReservedSql, tenantId: string, id: string, input: UpdatePresentationInput): Promise<PresentationRow | null> {
    const existing = await this.getPresentation(sql, tenantId, id);
    if (!existing) return null;

    const name = input.name ?? existing.name;
    const description = input.description !== undefined ? input.description : existing.description;
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_presentations.presentations SET
        name = ${name}, description = ${description || null}, updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async deletePresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM mod_presentations.presentations
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id`;
    return rows.length > 0;
  }

  /* ── Status transitions ── */

  async publishPresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null> {
    const rows = await sql`
      UPDATE mod_presentations.presentations SET status = 'published', updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async archivePresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null> {
    const rows = await sql`
      UPDATE mod_presentations.presentations SET status = 'archived', updated_at = ${new Date().toISOString()}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /* ── Slide management ── */

  async addSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, input: AddSlideInput): Promise<{ presentation: PresentationRow; slide: SlideDefinition } | null> {
    const pres = await this.getPresentation(sql, tenantId, presentationId);
    if (!pres) return null;

    const newSlide: SlideDefinition = {
      id: uuidv7(),
      title: input.title,
      layout: input.layout || null,
      content: input.content || {},
      notes: input.notes || null,
      sort_order: pres.slides.length,
    };
    const slides = [...pres.slides, newSlide];
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_presentations.presentations SET
        slides = ${JSON.stringify(slides)}, updated_at = ${now}
      WHERE id = ${presentationId} AND tenant_id = ${tenantId}
      RETURNING *`;
    if (!rows.length) return null;
    return { presentation: this.mapRow(rows[0]), slide: newSlide };
  }

  async updateSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideId: string, input: UpdateSlideInput): Promise<{ presentation: PresentationRow; slide: SlideDefinition } | null> {
    const pres = await this.getPresentation(sql, tenantId, presentationId);
    if (!pres) return null;

    const idx = pres.slides.findIndex((s) => s.id === slideId);
    if (idx === -1) return null;

    const updated = { ...pres.slides[idx] };
    if (input.title !== undefined) updated.title = input.title;
    if (input.layout !== undefined) updated.layout = input.layout || null;
    if (input.content !== undefined) updated.content = input.content || {};
    if (input.notes !== undefined) updated.notes = input.notes || null;

    const slides = [...pres.slides];
    slides[idx] = updated;
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_presentations.presentations SET
        slides = ${JSON.stringify(slides)}, updated_at = ${now}
      WHERE id = ${presentationId} AND tenant_id = ${tenantId}
      RETURNING *`;
    if (!rows.length) return null;
    return { presentation: this.mapRow(rows[0]), slide: updated };
  }

  async removeSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideId: string): Promise<boolean> {
    const pres = await this.getPresentation(sql, tenantId, presentationId);
    if (!pres) return false;

    const slides = pres.slides.filter((s) => s.id !== slideId);
    if (slides.length === pres.slides.length) return false; // not found

    // Re-index sort_order
    slides.forEach((s, i) => { s.sort_order = i; });
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_presentations.presentations SET
        slides = ${JSON.stringify(slides)}, updated_at = ${now}
      WHERE id = ${presentationId} AND tenant_id = ${tenantId}
      RETURNING id`;
    return rows.length > 0;
  }

  async reorderSlides(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideIds: string[]): Promise<PresentationRow | null> {
    const pres = await this.getPresentation(sql, tenantId, presentationId);
    if (!pres) return null;

    const slideMap = new Map(pres.slides.map((s) => [s.id, s]));
    const reordered: SlideDefinition[] = [];
    for (let i = 0; i < slideIds.length; i++) {
      const s = slideMap.get(slideIds[i]);
      if (!s) return null; // invalid slide ID
      reordered.push({ ...s, sort_order: i });
    }
    const now = new Date().toISOString();

    const rows = await sql`
      UPDATE mod_presentations.presentations SET
        slides = ${JSON.stringify(reordered)}, updated_at = ${now}
      WHERE id = ${presentationId} AND tenant_id = ${tenantId}
      RETURNING *`;
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  /* ── Row mapper ── */

  private mapRow(r: any): PresentationRow {
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      name: r.name,
      description: r.description,
      status: r.status,
      slides: typeof r.slides === 'string' ? JSON.parse(r.slides) : (r.slides || []),
      created_by: r.created_by,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
    };
  }
}
