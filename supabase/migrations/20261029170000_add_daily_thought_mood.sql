alter table public.daily_thought
	add column if not exists mood smallint check (mood between 1 and 5);
