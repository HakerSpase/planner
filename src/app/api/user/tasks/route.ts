import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

import { formatTask, sanitizeDueAt, sanitizeReminders, sanitizeSubtasks } from './task.mapper'

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
		.from('task')
		.select(
			'id,name,note,subtasks,priority,is_completed,created_at,completed_at,updated_at,order,due_at,reminders'
		)
		.eq('user_id', user.id)
		.order('order', { ascending: true })
		.order('created_at', { ascending: true })

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json((data || []).map(formatTask))
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
		.from('task')
		.insert({
			name: body.name || '',
			note: body.note || '',
			subtasks: sanitizeSubtasks(body.subtasks) ?? [],
			priority: body.priority || 'medium',
			is_completed: body.isCompleted || false,
			completed_at: body.isCompleted ? new Date().toISOString() : null,
			created_at: body.createdAt
				? new Date(body.createdAt).toISOString()
				: new Date().toISOString(),
			order: typeof body.order === 'number' ? body.order : 0,
			due_at: sanitizeDueAt(body.dueAt),
			reminders: sanitizeReminders(body.reminders),
			user_id: user.id
		})
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json(formatTask(data))
}
