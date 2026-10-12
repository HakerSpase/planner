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

	const { data, error } = await supabase
		.from('task')
		.select('*')
		.eq('user_id', user.id)
		.order('created_at', { ascending: true })

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	const formatted = (data || []).map(task => ({
		id: task.id,
		name: task.name,
		note: task.note ?? '',
		priority: task.priority,
		isCompleted: task.is_completed,
		createdAt: task.created_at,
		updatedAt: task.updated_at
	}))

	return NextResponse.json(formatted)
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
			priority: body.priority || 'medium',
			is_completed: body.isCompleted || false,
			created_at: body.createdAt ? new Date(body.createdAt).toISOString() : new Date().toISOString(),
			user_id: user.id
		})
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
		createdAt: data.created_at,
		updatedAt: data.updated_at
	})
}
