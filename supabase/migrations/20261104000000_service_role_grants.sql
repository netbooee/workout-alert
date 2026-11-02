-- Grants for the admin role (service_role), used by server-side scripts such
-- as scripts/review/seed-review-accounts.mjs. This project doesn't expose new
-- tables automatically, so tables only get the grants migrations give them,
-- and until now those were only for signed-in users. service_role bypasses
-- row level security and its key never ships in the app; this restores the
-- access Supabase gives it by default.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- And for tables and functions added by later migrations.
alter default privileges in schema public grant all privileges on tables to service_role;
alter default privileges in schema public grant all privileges on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
