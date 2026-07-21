-- Yearly leaderboard archive + records retention (2y live / 5y archive).
--
-- Policy: quotes-tracker submissions (public.records) are held for 2 years.
-- Before a year's records are deleted, its per-user yearly leaderboard
-- (submission counts + dense rank) is snapshotted into leaderboard_archive so
-- historical yearly toppers stay viewable without keeping the actual submitted
-- file rows. Archive rows are purged once the data year is older than 5 years.
--
-- Granularity: whole calendar years. A year is archived + deleted only when
-- the ENTIRE year is older than 2 years (data_year < current_year - 2), so
-- every deleted record is guaranteed older than 2 years AND the archived
-- snapshot is always computed from the complete year's data — atomically, in
-- the same transaction as the deletion. Example: all of 2026 is archived and
-- deleted on the first run on/after 2029-01-01.

-- 1. Archive table. user_id is SET NULL on profile deletion and the identity
--    fields are snapshotted as text, so rankings of departed employees survive.
CREATE TABLE IF NOT EXISTS public.leaderboard_archive (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  username text NOT NULL,
  full_name text,
  job_role text,
  branch text,
  year integer NOT NULL,
  quotes_count integer DEFAULT 0 NOT NULL,
  requotes_count integer DEFAULT 0 NOT NULL,
  reviews_count integer DEFAULT 0 NOT NULL,
  sales_count integer DEFAULT 0 NOT NULL,
  total_submitted integer DEFAULT 0 NOT NULL,
  rank integer NOT NULL,
  archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT leaderboard_archive_username_year_unique UNIQUE (username, year)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_archive_year
  ON public.leaderboard_archive (year, rank);

-- 2. RLS: read-only for signed-in users (same audience as the leaderboard).
--    No INSERT/UPDATE/DELETE policies — writes happen only inside the
--    SECURITY DEFINER prune function or via service_role.
ALTER TABLE public.leaderboard_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read leaderboard archive"
  ON public.leaderboard_archive;
CREATE POLICY "Authenticated users can read leaderboard archive"
  ON public.leaderboard_archive
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Archive + prune function. Counting rules mirror get_leaderboard_data
--    exactly (Quote / Requote* / %Review% / Sale, branch = most frequent
--    branch_name with latest activity breaking ties, rank = DENSE_RANK on
--    yearly total, username tie-break).
CREATE OR REPLACE FUNCTION public.archive_and_prune_old_records(p_tz TEXT DEFAULT 'Asia/Dhaka')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM timezone(p_tz, now()))::INT;
  v_year INT;
  v_archived_users INT;
  v_deleted INT;
  v_total_deleted INT := 0;
  v_years_archived INT[] := '{}';
  v_purged INT;
BEGIN
  FOR v_year IN
    SELECT DISTINCT EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT
    FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2
    ORDER BY 1
  LOOP
    -- Snapshot the year's leaderboard (only users who actually submitted).
    -- Re-runs refresh the row — safe because the year's records are always
    -- complete at this point (deletion happens below in the same transaction).
    INSERT INTO public.leaderboard_archive
      (user_id, username, full_name, job_role, branch, year,
       quotes_count, requotes_count, reviews_count, sales_count,
       total_submitted, rank)
    WITH year_stats AS (
      SELECT
        r.user_id,
        COUNT(*)::INT AS total_submitted,
        COUNT(*) FILTER (WHERE r.file_type = 'Quote')::INT AS quotes_count,
        COUNT(*) FILTER (WHERE r.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
        COUNT(*) FILTER (WHERE r.file_type LIKE '%Review%')::INT AS reviews_count,
        COUNT(*) FILTER (WHERE r.file_type = 'Sale')::INT AS sales_count
      FROM public.records r
      WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year
      GROUP BY r.user_id
    ),
    user_branches AS (
      SELECT DISTINCT ON (b.user_id)
        b.user_id,
        b.branch_name
      FROM (
        SELECT
          r2.user_id,
          r2.branch_name,
          COUNT(*) AS branch_cnt,
          MAX(r2.submitted_at) AS branch_latest
        FROM public.records r2
        WHERE EXTRACT(YEAR FROM timezone(p_tz, r2.submitted_at))::INT = v_year
        GROUP BY r2.user_id, r2.branch_name
      ) b
      ORDER BY b.user_id, b.branch_cnt DESC, b.branch_latest DESC
    )
    SELECT
      ys.user_id,
      COALESCE(p.username, ys.user_id::text) AS username,
      p.full_name,
      p.job_role,
      ub.branch_name,
      v_year,
      ys.quotes_count,
      ys.requotes_count,
      ys.reviews_count,
      ys.sales_count,
      ys.total_submitted,
      DENSE_RANK() OVER (
        ORDER BY ys.total_submitted DESC, COALESCE(p.username, ys.user_id::text) ASC
      )::INT AS rank
    FROM year_stats ys
    LEFT JOIN public.profiles p ON p.id = ys.user_id
    LEFT JOIN user_branches ub ON ub.user_id = ys.user_id
    ON CONFLICT (username, year) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      full_name = EXCLUDED.full_name,
      job_role = EXCLUDED.job_role,
      branch = EXCLUDED.branch,
      quotes_count = EXCLUDED.quotes_count,
      requotes_count = EXCLUDED.requotes_count,
      reviews_count = EXCLUDED.reviews_count,
      sales_count = EXCLUDED.sales_count,
      total_submitted = EXCLUDED.total_submitted,
      rank = EXCLUDED.rank,
      archived_at = timezone('utc'::text, now());

    GET DIAGNOSTICS v_archived_users = ROW_COUNT;

    -- Delete the archived year's records (all guaranteed older than 2 years)
    DELETE FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    v_total_deleted := v_total_deleted + v_deleted;
    v_years_archived := v_years_archived || v_year;

    RAISE NOTICE 'Archived year %: % users snapshotted, % records deleted',
      v_year, v_archived_users, v_deleted;
  END LOOP;

  -- Purge archive snapshots once the data year is older than 5 years
  DELETE FROM public.leaderboard_archive WHERE year < v_current_year - 5;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'years_archived', to_jsonb(v_years_archived),
    'records_deleted', v_total_deleted,
    'archive_rows_purged', v_purged,
    'run_at', timezone('utc'::text, now())
  );
END;
$$;

-- Destructive: not callable by app users — service_role / postgres (pg_cron) only.
REVOKE ALL ON FUNCTION public.archive_and_prune_old_records(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_and_prune_old_records(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.archive_and_prune_old_records(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.archive_and_prune_old_records(TEXT) TO service_role;

-- 4. Schedule: yearly on Jan 2 at 03:17 (year-granular pruning only changes at
--    the year boundary, so annual is sufficient). Falls back to a NOTICE if
--    pg_cron isn't available — then either enable the pg_cron extension in
--    Supabase Dashboard > Database > Extensions and re-run this block, or run
--    SELECT public.archive_and_prune_old_records(); manually each January.
DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not enable pg_cron automatically: %', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'archive-prune-old-records',
      '17 3 2 1 *',
      $cron$ SELECT public.archive_and_prune_old_records('Asia/Dhaka'); $cron$
    );
    RAISE NOTICE 'Scheduled archive-prune-old-records (yearly, Jan 2 03:17).';
  ELSE
    RAISE NOTICE 'pg_cron unavailable — run SELECT public.archive_and_prune_old_records(); manually each January.';
  END IF;
END
$do$;

-- Refresh PostgREST schema cache so the new table is queryable immediately
NOTIFY pgrst, 'reload schema';
