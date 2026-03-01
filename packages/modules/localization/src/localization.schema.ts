/**
 * M31 Localization — Zod Validation Schemas
 */
import { z } from 'zod';

export const MAX_LANGUAGES_PER_TENANT = 50;
export const MAX_KEYS_PER_TENANT = 10000;

const directionEnum = z.enum(['ltr', 'rtl']);

/* ── Languages ── */
export const createLanguageSchema = z.object({
  code: z.string().min(2).max(10).regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  name: z.string().min(1).max(100),
  native_name: z.string().min(1).max(100),
  direction: directionEnum,
  is_default: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
});

export const updateLanguageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  native_name: z.string().min(1).max(100).optional(),
  direction: directionEnum.optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

/* ── Translation Keys ── */
export const createTranslationKeySchema = z.object({
  namespace: z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/),
  key: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
});

export const updateTranslationKeySchema = z.object({
  description: z.string().max(1000).nullable().optional(),
});

/* ── Translations ── */
export const createTranslationSchema = z.object({
  key_id: z.string().uuid(),
  language_id: z.string().uuid(),
  value: z.string().min(1).max(10000),
  is_reviewed: z.boolean().optional().default(false),
});

export const updateTranslationSchema = z.object({
  value: z.string().min(1).max(10000).optional(),
  is_reviewed: z.boolean().optional(),
});

/* ── List ── */
export const listSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listTranslationsSchema = z.object({
  key_id: z.string().uuid().optional(),
  language_id: z.string().uuid().optional(),
  namespace: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});
