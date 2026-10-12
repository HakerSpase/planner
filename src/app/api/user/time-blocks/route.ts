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

	let body: { name?: unknown; color?: unknown; duration?: unknown }
	try {
		body = await request.json()
	} catch {
		return NextResponse.json(
			{ error: 'Некорректный формат запроса.' },
			{ status: 400 }
		)
	}
	if (!body || typeof body !== 'object') {
		return NextResponse.json(
			{ error: 'Некорректные данные блока.' },
			{ status: 400 }
		)
	}
	const duration = Number(body.duration)
	if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
		return NextResponse.json(
			{ error: 'Длительность должна быть от 1 до 1440 минут.' },
			{ status: 400 }
		)
	}
	if (
		typeof body.name !== 'string' ||
		!body.name.trim() ||
		body.name.length > 120
	) {
		return NextResponse.json(
			{ error: 'Укажите название длиной до 120 символов.' },
			{ status: 400 }
		)
	}
	if (
		body.color !== undefined &&
		body.color !== null &&
		typeof body.color !== 'string'
	) {
		return NextResponse.json(
			{ error: 'Некорректный цвет блока.' },
			{ status: 400 }
		)
	}

	const { data: lastBlock, error: orderError } = await supabase
		.from('time_block')
		.select('order')
		.eq('user_id', user.id)
		.order('order', { ascending: false })
		.limit(1)
		.maybeSingle()
	if (orderError) {
		return NextResponse.json({ error: orderError.message }, { status: 400 })
	}

	const { data, error } = await supabase
		.from('time_block')
		.insert({
			name: body.name.trim(),
			color: body.color || null,
			duration,
			order: (lastBlock?.order ?? 0) + 1,
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
