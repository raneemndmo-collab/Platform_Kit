/**
 * M12 Search Engine -- Schema validation (Zod)
 */

import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  module_id: z.string().max(100).optional(),
  object_type: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const createIndexEntrySchema = z.object({
  object_id: z.string().min(1).max(255),
  object_type: z.string().min(1).max(100),
  module_id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  content: z.string().max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createSynonymSchema = z.object({
  term: z.string().min(1).max(200),
  synonyms: z.array(z.string().min(1).max(200)).min(1).max(50),
});

export const updateSynonymSchema = z.object({
  synonyms: z.array(z.string().min(1).max(200)).min(1).max(50),
});

export const reindexSchema = z.object({
  module_id: z.string().max(100).optional(),
  object_type: z.string().max(100).optional(),
});
