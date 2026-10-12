import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const { ids } = await request.json()

	if (!Array.isArray(ids)) {
		return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
	}

	await Promise.all(
		ids.map((id: string, order: number) =>
			supabase
				.from('time_block')
				.update({ order: order + 1, updated_at: new Date().toISOString() })
				.eq('id', id)
				.eq('user_id', user.id)
		)
	)

	return NextResponse.json({ success: true })
}
