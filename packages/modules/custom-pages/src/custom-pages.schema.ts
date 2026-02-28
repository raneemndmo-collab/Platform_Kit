/**
 * M14 Custom Pages — Zod Validation Schemas
 */
import { z } from 'zod';

const sectionTypeEnum = z.enum(['dashboard_embed', 'report_embed', 'text_block', 'spacer', 'divider']);

const pageSectionSchema = z.object({
  section_type: sectionTypeEnum,
  order: z.number().int().min(0).optional(),
  reference_id: z.string().optional(),
  config: z.record(z.unknown()).optional().default({}),
});

export const createPageSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  layout: z.record(z.unknown()).optional().default({}),
  sections: z.array(pageSectionSchema).optional().default([]),
});

export const updatePageSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  icon: z.string().max(100).optional(),
  layout: z.record(z.unknown()).optional(),
  sections: z.array(pageSectionSchema).optional(),
});

export const addSectionSchema = z.object({
  section_type: sectionTypeEnum,
  order: z.number().int().min(0).optional(),
  reference_id: z.string().optional(),
  config: z.record(z.unknown()).optional().default({}),
});

export const updateSectionSchema = z.object({
  order: z.number().int().min(0).optional(),
  reference_id: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});
