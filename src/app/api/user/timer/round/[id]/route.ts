import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

	if (body.totalSeconds !== undefined) updateData.total_seconds = body.totalSeconds
	if (body.isCompleted !== undefined) updateData.is_completed = body.isCompleted

	const { data, error } = await supabase
		.from('pomodoro_round')
		.update(updateData)
		.eq('id', params.id)
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json({
		id: data.id,
		totalSeconds: data.total_seconds,
		isCompleted: data.is_completed,
		createdAt: data.created_at,
		updatedAt: data.updated_at
	})
}
