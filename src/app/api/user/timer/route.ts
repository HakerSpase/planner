import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function POST() {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { data, error } = await supabase.rpc('create_pomodoro_session')
	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}
	return NextResponse.json(data)
}
