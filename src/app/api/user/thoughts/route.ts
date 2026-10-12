import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
	const supabase = createClient()
	const { data: { user }, error: authError } = await supabase.auth.getUser()
	if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const { searchParams } = new URL(request.url)
	const start = searchParams.get('start')
	const end = searchParams.get('end')
	if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
		return NextResponse.json({ error: 'Укажите месяц для загрузки записей.' }, { status: 400 })
	}
	const { data, error } = await supabase.from('daily_thought').select('thought_date,content,updated_at').eq('user_id', user.id).gte('thought_date', start).lte('thought_date', end).order('thought_date')
	if (error) return NextResponse.json({ error: error.message }, { status: 400 })
	return NextResponse.json(data || [])
}

export async function PUT(request: Request) {
	const supabase = createClient()
	const { data: { user }, error: authError } = await supabase.auth.getUser()
	if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	const body = await request.json()
	if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || typeof body.content !== 'string' || body.content.length > 20000) {
		return NextResponse.json({ error: 'Проверьте дату и длину записи.' }, { status: 400 })
	}
	const { data, error } = await supabase.from('daily_thought').upsert({ user_id: user.id, thought_date: body.date, content: body.content }, { onConflict: 'user_id,thought_date' }).select('thought_date,content,updated_at').single()
	if (error) return NextResponse.json({ error: error.message }, { status: 400 })
	return NextResponse.json(data)
}
