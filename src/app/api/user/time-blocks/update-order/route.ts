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

	if (ids.some((id: unknown) => typeof id !== 'string')) {
		return NextResponse.json({ error: 'Each block id must be a string.' }, { status: 400 })
	}

	const results = await Promise.all(
		ids.map((id: string, order: number) =>
			supabase
				.from('time_block')
				.update({ order: order + 1, updated_at: new Date().toISOString() })
				.eq('id', id)
				.eq('user_id', user.id)
		)
	)
	const failedUpdate = results.find(result => result.error)
	if (failedUpdate?.error) {
		return NextResponse.json({ error: failedUpdate.error.message }, { status: 400 })
	}

	return NextResponse.json({ success: true })
}
