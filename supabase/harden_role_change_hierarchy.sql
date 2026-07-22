-- Harden role-change hierarchy at the DB layer (defense in depth).
--
-- Rule: only a superadmin may touch an admin/superadmin role in EITHER
-- direction. A non-superadmin admin may only move roles within {user,
-- supervisor}. This closes the gap where an admin could DEMOTE another admin
-- (OLD='admin' → NEW='supervisor'), which the previous check missed because it
-- only inspected NEW.role.
--
-- Structural DDL — mirror the final function into schema.sql (regenerate from
-- live after applying). Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.check_profile_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- service_role (API routes / system / migrations) bypasses.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Must be admin OR superadmin to change any role at all.
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    ) THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;

    -- Touching an admin/superadmin role in EITHER direction requires superadmin.
    IF (NEW.role IN ('admin', 'superadmin') OR OLD.role IN ('admin', 'superadmin'))
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'superadmin'
       ) THEN
      RAISE EXCEPTION 'Only a superadmin can create, promote, or demote admin/superadmin accounts.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
