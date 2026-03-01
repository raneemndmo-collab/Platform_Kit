/**
 * M21 AI Engine — Tool Registry Zod Schemas (Step 2)
 */
import { z } from 'zod';

const toolCategoryEnum = z.enum([
  'data_management', 'analytics', 'content',
  'communication', 'administration', 'ai', 'general',
]);

const toolExampleSchema = z.object({
  input: z.string().min(1),
  description: z.string().min(1),
});

export const createToolDefinitionSchema = z.object({
  action_id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: toolCategoryEnum.optional(),
  parameter_schema: z.record(z.unknown()).optional(),
  output_description: z.string().max(2000).optional(),
  examples: z.array(toolExampleSchema).max(10).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  requires_confirmation: z.boolean().optional(),
});

export const updateToolDefinitionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: toolCategoryEnum.optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
  parameter_schema: z.record(z.unknown()).optional(),
  output_description: z.string().max(2000).optional(),
  examples: z.array(toolExampleSchema).max(10).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  requires_confirmation: z.boolean().optional(),
});

export const createToolBindingSchema = z.object({
  tool_id: z.string().uuid(),
  action_id: z.string().min(1),
  input_mapping: z.record(z.unknown()).optional(),
  output_mapping: z.record(z.unknown()).optional(),
  pre_conditions: z.record(z.unknown()).optional(),
});
