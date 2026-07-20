-- Dynamic ordering for the Superadmin Todo panel ("recently active tasks").
-- Adds last_activity_at to public.todos, bumped automatically by a DB trigger
-- on every UPDATE, so no client code needs to write timestamps manually.
-- Also enables Realtime on todos so all open windows stay in sync.

-- 1. Add the column (default NOW() covers inserts; backfill existing rows from created_at)
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE
  DEFAULT timezone('utc'::text, now()) NOT NULL;

UPDATE public.todos
SET last_activity_at = created_at
WHERE last_activity_at IS DISTINCT FROM created_at;

-- 2. Trigger: bump last_activity_at on every meaningful UPDATE
--    (matches the hardened update_records_updated_at pattern)
CREATE OR REPLACE FUNCTION public.update_todos_last_activity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS todos_set_last_activity ON public.todos;
CREATE TRIGGER todos_set_last_activity
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_todos_last_activity();

-- 3. Index to support ORDER BY last_activity_at DESC on the daily fetch
CREATE INDEX IF NOT EXISTS idx_todos_last_activity
  ON public.todos (user_id, todo_date, last_activity_at DESC);

-- 4. Enable Realtime for todos (RLS already scopes events to the row owner).
--    Wrapped so re-running the migration is a no-op.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.todos;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
