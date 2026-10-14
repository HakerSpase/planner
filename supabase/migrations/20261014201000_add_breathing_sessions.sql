CREATE TABLE IF NOT EXISTS public.breathing_session (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	technique_id text NOT NULL,
	technique_name text NOT NULL,
	duration_seconds integer NOT NULL DEFAULT 0,
	cycles_count integer NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.breathing_session ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE tablename = 'breathing_session' AND policyname = 'Users can read their own breathing sessions'
	) THEN
		CREATE POLICY "Users can read their own breathing sessions"
			ON public.breathing_session FOR SELECT TO authenticated
			USING ((select auth.uid()) = user_id);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE tablename = 'breathing_session' AND policyname = 'Users can create their own breathing sessions'
	) THEN
		CREATE POLICY "Users can create their own breathing sessions"
			ON public.breathing_session FOR INSERT TO authenticated
			WITH CHECK ((select auth.uid()) = user_id);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE tablename = 'breathing_session' AND policyname = 'Users can delete their own breathing sessions'
	) THEN
		CREATE POLICY "Users can delete their own breathing sessions"
			ON public.breathing_session FOR DELETE TO authenticated
			USING ((select auth.uid()) = user_id);
	END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.breathing_session TO authenticated;
REVOKE ALL ON public.breathing_session FROM anon;
