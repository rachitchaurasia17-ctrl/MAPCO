-- Intentionally contains no customer or credential fixtures.
--
-- Security integration fixtures are randomized and created by
-- v2/scripts/security-verify.mjs against an explicitly acknowledged
-- non-production target. Keeping this file present makes `supabase db reset`
-- reproducible without shipping demo tenants or personal data as migrations.

