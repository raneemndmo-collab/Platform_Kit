/**
 * M16 Presentations — Zod Schemas
 *
 * Validation for metadata-only slide definitions.
 * No rendering, no template engine, no binary storage.
 * Slides use: title, layout, content (JSONB for report references by ID).
 */
import { z } from 'zod';

export const createPresentationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export const updatePresentationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
});

export const addSlideSchema = z.object({
  title: z.string().min(1).max(500),
  layout: z.string().max(100).optional(),
  content: z.record(z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateSlideSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  layout: z.string().max(100).optional(),
  content: z.record(z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
});
