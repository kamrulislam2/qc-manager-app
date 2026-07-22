-- Superadmin-configurable filename sanitizer RULES (word + enabled).
--
-- Supersedes set_sanitizer_words: rules support disable/re-enable per word.
-- Writes ONLY the 'sanitizer_rules' key via jsonb_set, preserving every other
-- per-row global_settings value (hidden_tabs, leave quotas, etc.). Mirrored to
-- all profile rows because the sanitizer reads each user's own global_settings.
--
-- Superadmin-only. Idempotent. DDL-only (safe to run in SQL editor / psql).

CREATE OR REPLACE FUNCTION public.set_sanitizer_rules(p_rules jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_rules}',
        COALESCE(p_rules, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

REVOKE ALL ON FUNCTION public.set_sanitizer_rules(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_sanitizer_rules(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sanitizer_rules(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
