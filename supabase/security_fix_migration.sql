-- =============================================================================
-- SECURITY FIX MIGRATION — Run in Supabase SQL Editor
-- Fixes: H2 (supervisor RLS), M1 (RPC permissions), M2 (audit forgery), L1 (push delete)
-- =============================================================================

-- ============================================================
-- H2 FIX: Scope supervisor chuti UPDATE & DELETE to supervised users only
-- ============================================================

-- Drop the overly-permissive policies
DROP POLICY IF EXISTS "Allow supervisors to update chuti status" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to delete chuti" ON public.chuti;

-- Recreate with proper scope: supervisor can only UPDATE chuti for users they supervise
CREATE POLICY "Allow supervisors to update chuti status"
ON public.chuti FOR UPDATE
USING (
  public.is_supervisor() AND (
    -- Direct supervision: the supervisor is in the user's supervisor_ids
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = chuti.user_id
      AND auth.uid() = ANY(supervisor_ids)
    )
    OR
    -- Delegated supervision: another supervisor delegated to the current user
    EXISTS (
      SELECT 1 FROM public.profiles u
      JOIN public.profiles s ON s.id = ANY(u.supervisor_ids)
      WHERE u.id = chuti.user_id
      AND s.delegated_supervisor_id = auth.uid()
    )
  )
);

-- Recreate with proper scope: supervisor can only DELETE chuti for users they supervise
CREATE POLICY "Allow supervisors to delete chuti"
ON public.chuti FOR DELETE
USING (
  public.is_supervisor() AND (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = chuti.user_id
      AND auth.uid() = ANY(supervisor_ids)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles u
      JOIN public.profiles s ON s.id = ANY(u.supervisor_ids)
      WHERE u.id = chuti.user_id
      AND s.delegated_supervisor_id = auth.uid()
    )
  )
);

-- ============================================================
-- M1 FIX: Restrict RPC functions to service_role only
-- ============================================================

-- get_user_ids_by_roles: only the server (service_role) should call this
REVOKE EXECUTE ON FUNCTION public.get_user_ids_by_roles(TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_ids_by_roles(TEXT[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_ids_by_roles(TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_ids_by_roles(TEXT[]) TO service_role;

-- get_push_subscriptions_for_users: only the server (service_role) should call this
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_users(UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_users(UUID[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_users(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_users(UUID[]) TO service_role;

-- delete_push_subscription: also restrict (it has internal auth checks but defense-in-depth)
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(UUID) TO service_role;

-- ============================================================
-- M2 FIX: Prevent audit log actor_id forgery
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;

CREATE POLICY "Allow authenticated users to insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- L1 FIX: Restrict push subscription delete to own subscriptions
-- ============================================================

DROP POLICY IF EXISTS "push_sub_delete_own" ON public.push_subscriptions;

CREATE POLICY "push_sub_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
