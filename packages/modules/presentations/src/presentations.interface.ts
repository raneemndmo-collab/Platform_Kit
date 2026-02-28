/**
 * M16 Presentations — Interface
 *
 * Service contract for metadata-only presentation management.
 * sql is passed as parameter (request-scoped, tenant-isolated).
 */
import type postgres from 'postgres';
import type {
  PresentationRow, CreatePresentationInput, UpdatePresentationInput,
  AddSlideInput, UpdateSlideInput,
} from './presentations.types.js';

export interface IPresentationsService {
  createPresentation(sql: postgres.ReservedSql, tenantId: string, createdBy: string, input: CreatePresentationInput): Promise<PresentationRow>;
  listPresentations(sql: postgres.ReservedSql, tenantId: string): Promise<PresentationRow[]>;
  getPresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null>;
  updatePresentation(sql: postgres.ReservedSql, tenantId: string, id: string, input: UpdatePresentationInput): Promise<PresentationRow | null>;
  deletePresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<boolean>;
  publishPresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null>;
  archivePresentation(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PresentationRow | null>;
  addSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, input: AddSlideInput): Promise<{ presentation: PresentationRow; slide: any } | null>;
  updateSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideId: string, input: UpdateSlideInput): Promise<{ presentation: PresentationRow; slide: any } | null>;
  removeSlide(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideId: string): Promise<boolean>;
  reorderSlides(sql: postgres.ReservedSql, tenantId: string, presentationId: string, slideIds: string[]): Promise<PresentationRow | null>;
}
