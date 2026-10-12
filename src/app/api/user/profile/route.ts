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

	// Получаем профиль пользователя
	const { data: profile } = await supabase
		.from('user')
		.select('id,name,work_interval,break_interval,intervals_count')
		.eq('id', user.id)
		.single()

	// Вычисляем даты
	const now = new Date()
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
	const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

	// Статистика
	const [totalRes, completedRes, todayRes, weekRes] = await Promise.all([
		supabase.from('task').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
		supabase
			.from('task')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.eq('is_completed', true),
		supabase
			.from('task')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.gte('created_at', todayStart),
		supabase
			.from('task')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.gte('created_at', weekStart)
	])

	return NextResponse.json({
		user: {
			id: user.id,
			email: user.email,
			name: profile?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
			workInterval: profile?.work_interval ?? 50,
			breakInterval: profile?.break_interval ?? 10,
			intervalsCount: profile?.intervals_count ?? 7
		},
		statistics: [
			{ label: 'Всего задач', value: totalRes.count || 0 },
			{ label: 'Выполненных задач', value: completedRes.count || 0 },
			{ label: 'Задач на сегодня', value: todayRes.count || 0 },
			{ label: 'Задач за неделю', value: weekRes.count || 0 }
		]
	})
}

export async function PUT(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const body = await request.json().catch(() => null)
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return NextResponse.json({ error: 'Некорректные настройки' }, { status: 400 })
	}
	const boundedInteger = (value: unknown, min: number, max: number) =>
		Number.isInteger(value) && Number(value) >= min && Number(value) <= max
	if (body.workInterval !== undefined && !boundedInteger(body.workInterval, 1, 180)) {
		return NextResponse.json({ error: 'Интервал работы должен быть от 1 до 180 минут' }, { status: 400 })
	}
	if (body.breakInterval !== undefined && !boundedInteger(body.breakInterval, 1, 60)) {
		return NextResponse.json({ error: 'Интервал перерыва должен быть от 1 до 60 минут' }, { status: 400 })
	}
	if (body.intervalsCount !== undefined && !boundedInteger(body.intervalsCount, 1, 10)) {
		return NextResponse.json({ error: 'Количество интервалов должно быть от 1 до 10' }, { status: 400 })
	}
	if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 80)) {
		return NextResponse.json({ error: 'Имя должно содержать не более 80 символов' }, { status: 400 })
	}

	const updateData: Record<string, any> = {
		updated_at: new Date().toISOString()
	}

	if (body.name !== undefined) updateData.name = body.name
	if (body.workInterval !== undefined) updateData.work_interval = body.workInterval
	if (body.breakInterval !== undefined) updateData.break_interval = body.breakInterval
	if (body.intervalsCount !== undefined) updateData.intervals_count = body.intervalsCount

	const { data, error } = await supabase
		.from('user')
		.update(updateData)
		.eq('id', user.id)
		.select()
		.single()

	if (error) {
		return NextResponse.json({ error: error.message }, { status: 400 })
	}

	return NextResponse.json(data)
}
