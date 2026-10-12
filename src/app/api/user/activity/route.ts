import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
	dateKeyInTimeZone,
	isValidTimeZone,
	startOfDayInTimeZone
} from '@/lib/time-zone'

export async function GET(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()
	if (authError || !user)
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const { searchParams } = new URL(request.url)
	const start = searchParams.get('start')
	const end = searchParams.get('end')
	const requestedTimeZone = searchParams.get('timeZone') || 'UTC'
	if (
		!start ||
		!end ||
		!/^\d{4}-\d{2}-\d{2}$/.test(start) ||
		!/^\d{4}-\d{2}-\d{2}$/.test(end)
	) {
		return NextResponse.json(
			{ error: 'Укажите период активности.' },
			{ status: 400 }
		)
	}
	const { data: profile } = await supabase
		.from('user')
		.select('time_zone')
		.eq('id', user.id)
		.maybeSingle()
	const timeZone = profile?.time_zone || requestedTimeZone
	if (!isValidTimeZone(timeZone))
		return NextResponse.json(
			{ error: 'Некорректный часовой пояс.' },
			{ status: 400 }
		)
	const startAt = startOfDayInTimeZone(start, timeZone)
	const endDate = new Date(`${end}T00:00:00Z`)
	endDate.setUTCDate(endDate.getUTCDate() + 1)
	const endAt = new Date(
		new Date(
			startOfDayInTimeZone(endDate.toISOString().slice(0, 10), timeZone)
		).getTime() - 1
	).toISOString()

	const [tasksResult, thoughtsResult] = await Promise.all([
		supabase
			.from('task')
			.select('completed_at')
			.eq('user_id', user.id)
			.eq('is_completed', true)
			.gte('completed_at', startAt)
			.lte('completed_at', endAt),
		supabase
			.from('daily_thought')
			.select('thought_date')
			.eq('user_id', user.id)
			.gte('thought_date', start)
			.lte('thought_date', end)
			.neq('content', '')
	])
	if (tasksResult.error || thoughtsResult.error) {
		return NextResponse.json(
			{ error: tasksResult.error?.message || thoughtsResult.error?.message },
			{ status: 400 }
		)
	}

	const counts: Record<string, number> = {}
	for (const task of tasksResult.data || []) {
		if (!task.completed_at) continue
		const date = dateKeyInTimeZone(new Date(task.completed_at), timeZone)
		counts[date] = (counts[date] || 0) + 1
	}
	for (const thought of thoughtsResult.data || []) {
		counts[thought.thought_date] = (counts[thought.thought_date] || 0) + 1
	}
	return NextResponse.json(counts)
}
