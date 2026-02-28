# M13 — Custom Tables (Data Studio) — Design Notes

## Scope
- Schema: `mod_connectors`
- Custom table builder for manual data entry
- CRUD on custom tables + rows
- All mutations via K3.executeAction()
- Events emitted for each mutation
- Lineage edges created in K7 when tables are created
- Datasets registered in K8 when tables are published

## Tables (mod_connectors schema)
1. `custom_tables` — id, tenant_id, name, display_name, description, columns JSONB, status, created_by, created_at, updated_at
2. `custom_table_rows` — id, table_id, tenant_id, row_data JSONB, row_order, created_by, updated_by, created_at, updated_at

## Actions (registered in K3)
1. `rasid.mod.connectors.table.create` — Create custom table
2. `rasid.mod.connectors.table.update` — Update custom table metadata/schema
3. `rasid.mod.connectors.table.delete` — Delete custom table (cascades rows)
4. `rasid.mod.connectors.table.row.create` — Add row to custom table
5. `rasid.mod.connectors.table.row.update` — Update row in custom table
6. `rasid.mod.connectors.table.row.delete` — Delete row from custom table

## Events
1. `rasid.mod.connectors.table.created`
2. `rasid.mod.connectors.table.updated`
3. `rasid.mod.connectors.table.deleted`
4. `rasid.mod.connectors.table.row.created`
5. `rasid.mod.connectors.table.row.updated`
6. `rasid.mod.connectors.table.row.deleted`

## Quality Gates
- All tables have tenant_id
- RLS enabled on all tables
- No Kernel modification
- No cross-module imports
- No FK to kernel schema
- All mutations via K3 pipeline
- No file >500 lines
- No function >80 lines
- Event-only communication

## Kernel Integration Points (READ-ONLY, no modification)
- K1 (IAM): Auth middleware for routes
- K3 (Action Registry): executeAction() for all mutations
- K5 (Event Bus): emit events after mutations
- K6 (Audit): automatic via K3 pipeline

## NOT in M13 scope (deferred to M8)
- Data connectors (external sources)
- File import (CSV/Excel/JSON)
- Schema discovery
- Sync logs
