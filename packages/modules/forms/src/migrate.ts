/**
 * M15 Forms Builder — Migration
 *
 * Creates mod_forms schema with two tables: forms, submissions.
 * RLS enforced. No cross-schema FK. No email. No workflow.
 */
import postgres from 'postgres';

export async function migrateModForms(adminUrl: string) {
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql.unsafe(`
      -- Schema
      CREATE SCHEMA IF NOT EXISTS mod_forms;

      -- Forms table
      CREATE TABLE IF NOT EXISTS mod_forms.forms (
        id          UUID PRIMARY KEY,
        tenant_id   UUID NOT NULL,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        status      VARCHAR(20) NOT NULL DEFAULT 'draft',
        fields      JSONB NOT NULL DEFAULT '[]'::jsonb,
        page_id     VARCHAR(255),
        created_by  UUID NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Submissions table
      CREATE TABLE IF NOT EXISTS mod_forms.submissions (
        id            UUID PRIMARY KEY,
        tenant_id     UUID NOT NULL,
        form_id       UUID NOT NULL REFERENCES mod_forms.forms(id) ON DELETE CASCADE,
        data          JSONB NOT NULL DEFAULT '{}'::jsonb,
        submitted_by  VARCHAR(255),
        submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- RLS on forms
      ALTER TABLE mod_forms.forms ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS forms_tenant_isolation ON mod_forms.forms;
      CREATE POLICY forms_tenant_isolation ON mod_forms.forms
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      -- RLS on submissions
      ALTER TABLE mod_forms.submissions ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS submissions_tenant_isolation ON mod_forms.submissions;
      CREATE POLICY submissions_tenant_isolation ON mod_forms.submissions
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_forms_tenant ON mod_forms.forms (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON mod_forms.submissions (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_form ON mod_forms.submissions (form_id);

      -- Grant to app role
      GRANT USAGE ON SCHEMA mod_forms TO rasid_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mod_forms TO rasid_app;
    `);
    console.log('[migrate] mod_forms schema ready');
  } finally {
    await sql.end();
  }
}
