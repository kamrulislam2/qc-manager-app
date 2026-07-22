-- Superadmin feature flags (global on/off toggles for functionality).
--
-- Writes ONLY the 'feature_flags' key via jsonb_set, preserving every other
-- per-row global_settings value. Mirrored to all profile rows because each
-- user reads their own global_settings. Shape: { "flag_key": false, ... }.
-- Absent or true = enabled; only explicit false disables.
--
-- Superadmin-only. Idempotent. DDL-only (safe).

CREATE OR REPLACE FUNCTION public.set_feature_flags(p_flags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{feature_flags}',
        COALESCE(p_flags, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

REVOKE ALL ON FUNCTION public.set_feature_flags(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_feature_flags(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_feature_flags(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
