-- Fix Superadmin profile update trigger & RPC WHERE clauses (pg_safeupdate compatibility)
-- Date: 2026-07-22

-- 1. Fix check_profile_updates() to treat superadmin as admin (allow editing any profile)
CREATE OR REPLACE FUNCTION public.check_profile_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If the session bypass variable is set, allow the update (system functions/syncs)
  IF current_setting('app.bypass_profile_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the editor is an admin or superadmin, allow everything
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  ) THEN
    RETURN NEW;
  END IF;

  -- If the editor is a supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ) THEN
    -- If editing self, allow everything
    IF auth.uid() = NEW.id THEN
      RETURN NEW;
    END IF;

    -- If editing an employee they directly supervise, enforce key constraints (prevent privilege escalation/sensitive settings modification)
    IF auth.uid() = ANY(NEW.supervisor_ids) OR auth.uid() = ANY(OLD.supervisor_ids) THEN
      IF OLD.role IS DISTINCT FROM NEW.role OR
         OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
         OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
         OLD.can_manage_rules IS DISTINCT FROM NEW.can_manage_rules OR
         OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
         (NEW.global_settings->>'office_leave_default') IS DISTINCT FROM (OLD.global_settings->>'office_leave_default') OR
         (NEW.global_settings->>'eid_fitr_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_fitr_leave') OR
         (NEW.global_settings->>'eid_adha_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_adha_leave') OR
         (NEW.global_settings->>'govt_holidays') IS DISTINCT FROM (OLD.global_settings->>'govt_holidays') OR
         (NEW.global_settings->>'password_reset_status') IS DISTINCT FROM (OLD.global_settings->>'password_reset_status')
      THEN
        RAISE EXCEPTION 'Supervisors cannot modify roles, supervisor assignments, access permissions, or sensitive global leave settings for their team members.';
      END IF;
      RETURN NEW;
    END IF;

    -- If editing an employee they do NOT supervise, enforce column constraints
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
       OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
       OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
       OLD.delegated_supervisor_id IS DISTINCT FROM NEW.delegated_supervisor_id OR
       OLD.delegated_leave_supervisor_id IS DISTINCT FROM NEW.delegated_leave_supervisor_id OR
       OLD.delegated_kpi_supervisor_id IS DISTINCT FROM NEW.delegated_kpi_supervisor_id OR
       OLD.eligible_govt_holiday IS DISTINCT FROM NEW.eligible_govt_holiday OR
       OLD.eligible_office_leave IS DISTINCT FROM NEW.eligible_office_leave OR
       OLD.allow_overtime IS DISTINCT FROM NEW.allow_overtime OR
       OLD.allow_reserve IS DISTINCT FROM NEW.allow_reserve OR
       OLD.needs_supervisor_approval IS DISTINCT FROM NEW.needs_supervisor_approval OR
       OLD.global_settings IS DISTINCT FROM NEW.global_settings
    THEN
      RAISE EXCEPTION 'Supervisors can only modify basic settings (working hours, break time, default sign in/out, quotes allowed types) for users outside their team.';
    END IF;

    RETURN NEW;
  END IF;

  -- Default fallback: only allow users to edit self (non-supervisors)
  IF auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;

-- 2. Fix handle_new_user() to accept superadmin when pulling default settings
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
  v_global_settings JSONB;
BEGIN
  -- Get current global settings from an existing admin/superadmin profile
  SELECT global_settings INTO v_global_settings
  FROM public.profiles
  WHERE role IN ('admin', 'superadmin')
  LIMIT 1;

  IF v_global_settings IS NULL THEN
    v_global_settings := '{"office_leave_default": 14, "eid_fitr_leave": 0, "eid_adha_leave": 0, "govt_holidays": []}'::jsonb;
  END IF;

  base_username := UPPER(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  final_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || suffix;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    has_chuti_access,
    has_quotes_access,
    can_manage_rules,
    global_settings
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'has_chuti_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'has_quotes_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'can_manage_rules')::boolean, false),
    v_global_settings
  );

  RETURN NEW;
END;
$$;

-- 3. Fix compliance_rules policies to include superadmin
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules;
CREATE POLICY "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));

DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules;
CREATE POLICY "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));

DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules;
CREATE POLICY "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));

DROP POLICY IF EXISTS "Allow authenticated to read compliance rules" ON public.compliance_rules;
CREATE POLICY "Allow authenticated to read compliance rules" ON public.compliance_rules FOR SELECT TO authenticated USING (((NOT is_deleted) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true)))))));

NOTIFY pgrst, 'reload schema';
