/**
 * M31 Localization — Type Definitions (Metadata Only)
 * Language table, translation key-value, RTL/LTR flags.
 * No runtime translation engine.
 */

export interface Language {
  id: string;
  tenant_id: string;
  code: string;        // ISO 639-1 e.g. 'ar', 'en'
  name: string;        // e.g. 'Arabic', 'English'
  native_name: string; // e.g. 'العربية', 'English'
  direction: 'ltr' | 'rtl';
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TranslationKey {
  id: string;
  tenant_id: string;
  namespace: string;
  key: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Translation {
  id: string;
  tenant_id: string;
  key_id: string;
  language_id: string;
  value: string;
  is_reviewed: boolean;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}
