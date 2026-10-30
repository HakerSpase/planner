import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

import { formatTask, sanitizeDueAt, sanitizeReminders, sanitizeSubtasks } from '../task.mapper'

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
	if (body.subtasks !== undefined) {
		const subtasks = sanitizeSubtasks(body.subtasks)
		if (!subtasks) {
			return NextResponse.json(
				{ error: 'Некорректный список подзадач' },
				{ status: 400 }
			)
		}
		updateData.subtasks = subtasks
	}
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
	if (body.dueAt !== undefined) updateData.due_at = sanitizeDueAt(body.dueAt)
	if (body.reminders !== undefined) updateData.reminders = sanitizeReminders(body.reminders)

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

	return NextResponse.json(formatTask(data))
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
