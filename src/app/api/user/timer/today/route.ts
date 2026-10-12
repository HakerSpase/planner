import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const now = new Date()
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

	const { data: session } = await supabase
		.from('pomodoro_session')
		.select('id,is_completed,created_at,updated_at,rounds:pomodoro_round(id,total_seconds,is_completed,created_at,updated_at)')
		.eq('user_id', user.id)
		.gte('created_at', todayStart)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle()

	if (!session) {
		return NextResponse.json(null)
	}

	const sortedRounds = (session.rounds || []).sort(
		(a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
	)

	return NextResponse.json({
		id: session.id,
		isCompleted: session.is_completed,
		createdAt: session.created_at,
		updatedAt: session.updated_at,
		rounds: sortedRounds.map((round: any) => ({
			id: round.id,
			totalSeconds: round.total_seconds,
			isCompleted: round.is_completed,
			createdAt: round.created_at,
			updatedAt: round.updated_at
		}))
	})
}
