/**
 * M21 AI Engine — RAG Engine Zod Schemas (Step 4)
 */
import { z } from 'zod';

export const CreateRagSourceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  module_id: z.string().min(1).max(100),
  object_type: z.string().min(1).max(100),
  metadata_filters: z.record(z.unknown()).optional().default({}),
});

export const UpdateRagSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  module_id: z.string().min(1).max(100).optional(),
  object_type: z.string().min(1).max(100).optional(),
  metadata_filters: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

export const RagRetrieveSchema = z.object({
  query: z.string().min(1).max(500),
  source_ids: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});
