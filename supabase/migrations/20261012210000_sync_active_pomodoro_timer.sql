alter table public.pomodoro_session
	add column if not exists active_round_id text,
	add column if not exists timer_is_running boolean not null default false,
	add column if not exists timer_is_break boolean not null default false,
	add column if not exists timer_seconds_remaining integer not null default 0,
	add column if not exists timer_started_at timestamptz;

alter table public.pomodoro_session
	add constraint pomodoro_session_timer_seconds_check
	check (timer_seconds_remaining between 0 and 10800);
