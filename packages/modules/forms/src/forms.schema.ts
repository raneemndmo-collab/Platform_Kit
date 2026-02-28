/**
 * M15 Forms Builder — Zod Validation Schemas
 *
 * Metadata-only. No workflow. No conditional logic.
 */
import { z } from 'zod';

const fieldDefSchema = z.object({
  field_id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'email', 'date', 'select', 'checkbox', 'textarea', 'radio']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
});

export const createFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldDefSchema).min(1),
  page_id: z.string().optional(),
});

export const updateFormSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldDefSchema).min(1).optional(),
  page_id: z.string().nullable().optional(),
});

export const createSubmissionSchema = z.object({
  data: z.record(z.unknown()),
  submitted_by: z.string().optional(),
});
