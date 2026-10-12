import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const url = new URL(request.url)
	const requestedOffset = Number(url.searchParams.get('timezoneOffset'))
	const timezoneOffset =
		Number.isFinite(requestedOffset) && Math.abs(requestedOffset) <= 840
			? requestedOffset
			: 0
	const localNow = new Date(Date.now() - timezoneOffset * 60_000)
	const todayStart = new Date(
		Date.UTC(
			localNow.getUTCFullYear(),
			localNow.getUTCMonth(),
			localNow.getUTCDate()
		) +
			timezoneOffset * 60_000
	).toISOString()

	const { data: session } = await supabase
		.from('pomodoro_session')
		.select(
			'id,is_completed,created_at,updated_at,active_round_id,timer_is_running,timer_is_break,timer_seconds_remaining,timer_started_at,rounds:pomodoro_round(id,round_number,total_seconds,is_completed,created_at,updated_at)'
		)
		.eq('user_id', user.id)
		.gte('created_at', todayStart)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle()

	if (!session) {
		return NextResponse.json(null)
	}

	const sortedRounds = (session.rounds || []).sort(
		(a: any, b: any) => a.round_number - b.round_number
	)

	return NextResponse.json({
		id: session.id,
		isCompleted: session.is_completed,
		createdAt: session.created_at,
		updatedAt: session.updated_at,
		activeRoundId: session.active_round_id,
		timerIsRunning: session.timer_is_running,
		timerIsBreak: session.timer_is_break,
		timerSecondsRemaining: session.timer_seconds_remaining,
		timerStartedAt: session.timer_started_at,
		rounds: sortedRounds.map((round: any) => ({
			id: round.id,
			totalSeconds: round.total_seconds,
			isCompleted: round.is_completed,
			createdAt: round.created_at,
			updatedAt: round.updated_at
		}))
	})
}
