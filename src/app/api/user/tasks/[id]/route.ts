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

	if (body.name !== undefined) updateData.name = body.name
	if (body.note !== undefined) updateData.note = body.note
	if (body.priority !== undefined) updateData.priority = body.priority
	if (body.isCompleted !== undefined) {
		updateData.is_completed = body.isCompleted
		updateData.completed_at = body.isCompleted ? new Date().toISOString() : null
	}
	// An empty date means "unscheduled". Store SQL NULL instead of an invalid
	// empty timestamp, which previously made the optimistic card jump and roll back.
	if (body.createdAt !== undefined)
		updateData.created_at = body.createdAt || null
	if (body.order !== undefined) updateData.order = body.order

	const { data, error } = await supabase
		.from('task')
		.update(updateData)
		.eq('id', params.id)
		.eq('user_id', user.id)
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json({
		id: data.id,
		name: data.name,
		note: data.note ?? '',
		priority: data.priority,
		isCompleted: data.is_completed,
		completedAt: data.completed_at,
		createdAt: data.created_at,
		updatedAt: data.updated_at,
		order: data.order ?? 0
	})
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
		.from('task')
		.delete()
		.eq('id', params.id)
		.eq('user_id', user.id)

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json({ success: true })
}
