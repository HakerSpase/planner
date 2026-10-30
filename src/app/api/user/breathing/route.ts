import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET() {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { data, error } = await supabase
		.from('breathing_session')
		.select('id,technique_id,technique_name,duration_seconds,cycles_count,details,created_at')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false })
		.limit(30)

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json(data || [])
}

export async function POST(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const body = await request.json()

	const { data, error } = await supabase
		.from('breathing_session')
		.insert({
			technique_id: body.techniqueId || 'box',
			technique_name: body.techniqueName || 'Квадратное дыхание',
			duration_seconds: body.durationSeconds || 0,
			cycles_count: body.cyclesCount || 0,
			details: body.details ?? null,
			user_id: user.id
		})
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json(data)
}
