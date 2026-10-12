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
		.from('time_block')
		.select('id,name,color,duration,order,created_at,updated_at')
		.eq('user_id', user.id)
		.order('order', { ascending: true })

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	const formatted = (data || []).map(item => ({
		id: item.id,
		name: item.name,
		color: item.color,
		duration: item.duration,
		order: item.order,
		createdAt: item.created_at,
		updatedAt: item.updated_at
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
	const duration = Number(body.duration)
	if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
		return NextResponse.json({ error: 'Длительность должна быть от 1 до 1440 минут.' }, { status: 400 })
	}

	const { data, error } = await supabase
		.from('time_block')
		.insert({
			name: body.name || '',
			color: body.color || null,
			duration,
			order: body.order || 1,
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
		color: data.color,
		duration: data.duration,
		order: data.order,
		createdAt: data.created_at,
		updatedAt: data.updated_at
	})
}
