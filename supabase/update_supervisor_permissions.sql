-- Update Supervisor KPI & Performance Permissions
-- Run this in your Supabase SQL Editor:

-- 1. Helper function to check if a supervisor supervises an employee (directly or via delegation)
CREATE OR REPLACE FUNCTION public.is_supervisor_of(supervisor_id UUID, employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = employee_id
    AND supervisor_id = ANY(supervisor_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.profiles u
    JOIN public.profiles s ON s.id = ANY(u.supervisor_ids)
    WHERE u.id = employee_id
    AND s.delegated_supervisor_id = supervisor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Profiles SELECT policies
DROP POLICY IF EXISTS "Allow admin/supervisor to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisor to read supervised profiles" ON public.profiles;

CREATE POLICY "Allow admin to read all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

CREATE POLICY "Allow supervisor to read supervised profiles"
ON public.profiles FOR SELECT
USING (
  public.is_supervisor() 
  AND (
    id = auth.uid() 
    OR public.is_supervisor_of(auth.uid(), id)
  )
);

-- 3. Update Profiles UPDATE policies
DROP POLICY IF EXISTS "Allow supervisors to update supervised profiles" ON public.profiles;

CREATE POLICY "Allow supervisors to update supervised profiles"
ON public.profiles FOR UPDATE
USING (
  public.is_supervisor() AND public.is_supervisor_of(auth.uid(), id)
)
WITH CHECK (
  public.is_supervisor() AND public.is_supervisor_of(auth.uid(), id)
);

-- 4. Update KPI Assessments SELECT and Write policies
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow select for owner, admin, or assigned supervisor" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow insert/update/delete for admin, supervisor, or self" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow insert/update/delete for owner, admin, or assigned supervisor" ON public.kpi_assessments;

CREATE POLICY "Allow select for owner, admin, or assigned supervisor" 
ON public.kpi_assessments FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id 
  OR public.is_admin() 
  OR (public.is_supervisor() AND public.is_supervisor_of(auth.uid(), user_id))
);

CREATE POLICY "Allow insert/update/delete for owner, admin, or assigned supervisor" 
ON public.kpi_assessments FOR ALL 
TO authenticated 
USING (
  auth.uid() = user_id 
  OR public.is_admin() 
  OR (public.is_supervisor() AND public.is_supervisor_of(auth.uid(), user_id))
);
