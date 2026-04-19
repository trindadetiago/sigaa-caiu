-- Per-layer health check columns. Additive; existing rows remain valid.
-- Run with:  npx wrangler d1 execute sigaa-caiu-db --local  --file=schema_migration_layers.sql
--            npx wrangler d1 execute sigaa-caiu-db --remote --file=schema_migration_layers.sql
ALTER TABLE checks ADD COLUMN reachability_status TEXT;
ALTER TABLE checks ADD COLUMN reachability_http INTEGER;
ALTER TABLE checks ADD COLUMN reachability_ms INTEGER;
ALTER TABLE checks ADD COLUMN reachability_error TEXT;
ALTER TABLE checks ADD COLUMN portal_status TEXT;
ALTER TABLE checks ADD COLUMN portal_error TEXT;
ALTER TABLE checks ADD COLUMN login_form_status TEXT;
ALTER TABLE checks ADD COLUMN login_form_error TEXT;
ALTER TABLE checks ADD COLUMN login_e2e_status TEXT;
ALTER TABLE checks ADD COLUMN login_e2e_error TEXT;
