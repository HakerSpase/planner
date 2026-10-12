with ranked_rounds as (
	select id, row_number() over (partition by pomodoro_session_id order by created_at, ctid) as position
	from public.pomodoro_round
)
update public.pomodoro_round as rounds
set round_number = ranked_rounds.position
from ranked_rounds
where rounds.id = ranked_rounds.id;
