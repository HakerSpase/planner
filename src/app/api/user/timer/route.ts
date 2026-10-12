import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	// Получаем intervals_count пользователя
	const { data: profile } = await supabase
		.from('user')
		.select('intervals_count')
		.eq('id', user.id)
		.single()

	const intervalsCount = profile?.intervals_count || 7

	// Создаем сессию
	const { data: session, error: sessionError } = await supabase
		.from('pomodoro_session')
		.insert({
			user_id: user.id,
			is_completed: false
		})
		.select()
		.single()

	if (sessionError) {
		return NextResponse.json({ error: sessionError.message }, { status: 400 })
	}

	// Создаем раунды
	const roundsData = Array.from({ length: intervalsCount }, () => ({
		pomodoro_session_id: session.id,
		total_seconds: 0,
		is_completed: false
	}))

	const { data: rounds, error: roundsError } = await supabase
		.from('pomodoro_round')
		.insert(roundsData)
		.select()

	if (roundsError) {
		return NextResponse.json({ error: roundsError.message }, { status: 400 })
	}

	return NextResponse.json({
		id: session.id,
		isCompleted: session.is_completed,
		createdAt: session.created_at,
		updatedAt: session.updated_at,
		rounds: (rounds || []).map(r => ({
			id: r.id,
			totalSeconds: r.total_seconds,
			isCompleted: r.is_completed,
			createdAt: r.created_at,
			updatedAt: r.updated_at
		}))
	})
}
