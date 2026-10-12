alter table public.pomodoro_round add column if not exists round_number integer;

with ranked_rounds as (
	select id, row_number() over (partition by pomodoro_session_id order by created_at, id) as position
	from public.pomodoro_round
)
update public.pomodoro_round as rounds
set round_number = ranked_rounds.position
from ranked_rounds
where rounds.id = ranked_rounds.id and rounds.round_number is null;

alter table public.pomodoro_round alter column round_number set not null;
create unique index if not exists pomodoro_round_session_round_number_key
	on public.pomodoro_round (pomodoro_session_id, round_number);

create or replace function public.create_pomodoro_session()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_user_id text := (select auth.uid())::text;
	v_intervals integer := 7;
	v_session public.pomodoro_session%rowtype;
	v_rounds jsonb;
begin
	if v_user_id is null then
		raise exception 'Authentication required';
	end if;

	select coalesce(intervals_count, 7)
	into v_intervals
	from public."user"
	where id = v_user_id;
	v_intervals := greatest(1, least(coalesce(v_intervals, 7), 10));

	insert into public.pomodoro_session (user_id, is_completed)
	values (v_user_id, false)
	returning * into v_session;

	with inserted_rounds as (
		insert into public.pomodoro_round (pomodoro_session_id, round_number, total_seconds, is_completed)
		select v_session.id, series.round_number, 0, false
		from pg_catalog.generate_series(1, v_intervals) as series(round_number)
		returning id, round_number, total_seconds, is_completed, created_at, updated_at
	)
	select coalesce(
		pg_catalog.jsonb_agg(
			pg_catalog.jsonb_build_object(
				'id', id,
				'totalSeconds', total_seconds,
				'isCompleted', is_completed,
				'createdAt', created_at,
				'updatedAt', updated_at
			) order by round_number
		), '[]'::jsonb
	)
	into v_rounds
	from inserted_rounds;

	return pg_catalog.jsonb_build_object(
		'id', v_session.id,
		'isCompleted', v_session.is_completed,
		'createdAt', v_session.created_at,
		'updatedAt', v_session.updated_at,
		'rounds', v_rounds
	);
end;
$$;
