alter table public.task
	add column if not exists completed_at timestamptz;

update public.task
set completed_at = updated_at
where is_completed = true and completed_at is null;

create index if not exists task_user_completed_at_idx
	on public.task (user_id, completed_at)
	where is_completed = true;
