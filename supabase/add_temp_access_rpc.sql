-- Superadmin time-boxed per-role tab overrides (Temporary Access Controls).
--
-- Writes ONLY the 'temp_access' key via jsonb_set, preserving every other
-- per-row global_settings value. Mirrored to all profile rows. Shape:
--   [ { "role": "user", "tabKey": "todo", "action": "grant"|"revoke",
--       "expires_at": "2026-01-01T00:00:00.000Z" }, ... ]
-- Enforcement + expiry are client-side (compared to now) — no cron.
--
-- Superadmin-only. Idempotent. DDL-only (safe).

CREATE OR REPLACE FUNCTION public.set_temp_access(p_entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure temporary access.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{temp_access}',
        COALESCE(p_entries, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

REVOKE ALL ON FUNCTION public.set_temp_access(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_temp_access(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_temp_access(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
