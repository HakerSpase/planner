import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function PUT(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const body = await request.json()
	const updateData: Record<string, any> = {
		updated_at: new Date().toISOString()
	}

	if (body.isCompleted !== undefined) updateData.is_completed = body.isCompleted
	if (body.activeRoundId !== undefined)
		updateData.active_round_id = body.activeRoundId
	if (body.timerIsRunning !== undefined) {
		if (typeof body.timerIsRunning !== 'boolean')
			return NextResponse.json(
				{ error: 'Некорректное состояние Pomodoro.' },
				{ status: 400 }
			)
		updateData.timer_is_running = body.timerIsRunning
	}
	if (body.timerIsBreak !== undefined) {
		if (typeof body.timerIsBreak !== 'boolean')
			return NextResponse.json(
				{ error: 'Некорректный этап Pomodoro.' },
				{ status: 400 }
			)
		updateData.timer_is_break = body.timerIsBreak
	}
	if (body.timerSecondsRemaining !== undefined) {
		const seconds = Number(body.timerSecondsRemaining)
		if (!Number.isInteger(seconds) || seconds < 0 || seconds > 10800) {
			return NextResponse.json(
				{ error: 'Некорректное время Pomodoro.' },
				{ status: 400 }
			)
		}
		updateData.timer_seconds_remaining = seconds
	}
	if (body.timerStartedAt !== undefined) {
		if (
			body.timerStartedAt !== null &&
			(typeof body.timerStartedAt !== 'string' ||
				Number.isNaN(Date.parse(body.timerStartedAt)))
		) {
			return NextResponse.json(
				{ error: 'Некорректное время запуска.' },
				{ status: 400 }
			)
		}
		updateData.timer_started_at = body.timerStartedAt
	}

	const { data, error } = await supabase
		.from('pomodoro_session')
		.update(updateData)
		.eq('id', params.id)
		.eq('user_id', user.id)
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json(data)
}

export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { error } = await supabase
		.from('pomodoro_session')
		.delete()
		.eq('id', params.id)
		.eq('user_id', user.id)

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json({ success: true })
}
