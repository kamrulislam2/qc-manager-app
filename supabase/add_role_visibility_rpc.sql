-- Superadmin-configurable per-role tab/subtab visibility.
--
-- Writes ONLY the 'role_visibility' key via jsonb_set, preserving every other
-- per-row global_settings value. Mirrored to all profile rows because each
-- user's sidebar reads their own global_settings. Shape:
--   { "user": { "todo": false }, "supervisor": { ... }, "admin": { ... } }
-- A tab is hidden for a role only when explicitly false; absent = visible.
--
-- Superadmin-only. Idempotent. DDL-only (safe).

CREATE OR REPLACE FUNCTION public.set_role_visibility(p_visibility jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure role visibility.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{role_visibility}',
        COALESCE(p_visibility, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

REVOKE ALL ON FUNCTION public.set_role_visibility(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_role_visibility(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_role_visibility(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
