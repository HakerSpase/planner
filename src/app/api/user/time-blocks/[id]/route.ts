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
	if (body.duration !== undefined) {
		const duration = Number(body.duration)
		if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
			return NextResponse.json({ error: 'Длительность должна быть от 1 до 1440 минут.' }, { status: 400 })
		}
		body.duration = duration
	}
	const updateData: Record<string, any> = {
		updated_at: new Date().toISOString()
	}

	if (body.name !== undefined) updateData.name = body.name
	if (body.color !== undefined) updateData.color = body.color
	if (body.duration !== undefined) updateData.duration = body.duration
	if (body.order !== undefined) updateData.order = body.order

	const { data, error } = await supabase
		.from('time_block')
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
		color: data.color,
		duration: data.duration,
		order: data.order,
		createdAt: data.created_at,
		updatedAt: data.updated_at
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
		.from('time_block')
		.delete()
		.eq('id', params.id)
		.eq('user_id', user.id)

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json({ success: true })
}
