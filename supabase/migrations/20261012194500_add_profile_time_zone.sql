alter table public."user"
	add column if not exists time_zone text;
