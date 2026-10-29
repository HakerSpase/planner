alter table public.task
	add column if not exists subtasks jsonb not null default '[]'::jsonb;

alter table public.task
	add constraint task_subtasks_is_array
	check (jsonb_typeof(subtasks) = 'array' and jsonb_array_length(subtasks) <= 200);
