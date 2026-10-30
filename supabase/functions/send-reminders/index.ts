// Напоминания о задачах через веб-пуш (Windows, Android, macOS — любой браузер с push).
// Вызывается раз в минуту из pg_cron (с секретом x-cron-secret) и вручную из настроек —
// кнопкой «Проверить» (с токеном пользователя, body: { test: true }).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Ключи веб-пуша и секрет cron лежат в закрытой таблице app_secret (RLS, только service role)
let secrets: Promise<Record<string, string>> | null = null
const loadSecrets = () =>
	(secrets ??= (async () => {
		const { data, error } = await admin.from('app_secret').select('name,value')
		if (error) throw error
		const map = Object.fromEntries((data || []).map(row => [row.name, row.value]))
		webpush.setVapidDetails('https://mplanner-dun.vercel.app', map.vapid_public, map.vapid_private)
		return map
	})())

const MINUTE = 60_000
// Пропущенный запуск (сбой, задержка cron) догоняем в пределах этого окна
const CATCH_UP = 10 * MINUTE
const MAX_OFFSET = 8 * 24 * 60 * MINUTE

const cors = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface ISubscription {
	id: string
	user_id: string
	endpoint: string
	p256dh: string
	auth: string
}

async function sendToUser(userId: string, payload: Record<string, unknown>) {
	const { data: subscriptions } = await admin
		.from('push_subscription')
		.select('id,user_id,endpoint,p256dh,auth')
		.eq('user_id', userId)
	let delivered = 0
	for (const subscription of (subscriptions || []) as ISubscription[]) {
		try {
			await webpush.sendNotification(
				{ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
				JSON.stringify(payload),
				{ TTL: 60 * 60, urgency: 'high' }
			)
			delivered++
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode
			// Браузер отписался или подписка устарела — убираем её
			if (status === 404 || status === 410) await admin.from('push_subscription').delete().eq('id', subscription.id)
			else console.error('push failed', status, (error as Error).message)
		}
	}
	return delivered
}

function describe(offset: number, dueAt: Date, timeZone: string) {
	const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone }).format(dueAt)
	if (offset === 0) return `Сейчас · ${time}`
	if (offset < 60) return `Через ${offset} мин · в ${time}`
	if (offset < 24 * 60) {
		const hours = Math.floor(offset / 60)
		const minutes = offset % 60
		return `Через ${hours} ч${minutes ? ` ${minutes} мин` : ''} · в ${time}`
	}
	const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone }).format(dueAt)
	return `${date} в ${time}`
}

async function runSchedule() {
	const now = Date.now()
	const { data: tasks, error } = await admin
		.from('task')
		.select('id,user_id,name,due_at,reminders')
		.eq('is_completed', false)
		.not('due_at', 'is', null)
		.not('reminders', 'is', null)
		.gte('due_at', new Date(now - CATCH_UP).toISOString())
		.lte('due_at', new Date(now + MAX_OFFSET).toISOString())
	if (error) throw error

	const userIds = Array.from(new Set((tasks || []).map(task => task.user_id)))
	const { data: users } = userIds.length
		? await admin.from('user').select('id,time_zone').in('id', userIds)
		: { data: [] }
	const timeZones = new Map((users || []).map(user => [user.id, user.time_zone || 'Europe/Moscow']))

	let sent = 0
	for (const task of tasks || []) {
		const dueAt = new Date(task.due_at)
		for (const offset of (task.reminders as number[]) || []) {
			const fireAt = dueAt.getTime() - offset * MINUTE
			if (fireAt > now || fireAt <= now - CATCH_UP) continue
			// Запись в журнал — замок: второй параллельный запуск получит конфликт и не отправит повторно
			const { error: lockError } = await admin
				.from('reminder_log')
				.insert({ task_id: task.id, due_at: task.due_at, offset_minutes: offset })
			if (lockError) continue
			sent += await sendToUser(task.user_id, {
				title: task.name || 'Задача',
				body: describe(offset, dueAt, timeZones.get(task.user_id) || 'Europe/Moscow'),
				tag: `task-${task.id}-${offset}`,
				url: '/i/tasks',
				requireInteraction: offset === 0
			})
		}
	}

	// Журнал старше двух недель не нужен
	await admin.from('reminder_log').delete().lt('due_at', new Date(now - 14 * 24 * 60 * MINUTE).toISOString())
	return { tasks: tasks?.length || 0, sent }
}

Deno.serve(async request => {
	if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
	const body = await request.json().catch(() => ({}))
	const { cron_secret: cronSecret } = await loadSecrets()

	if (body?.test) {
		const token = request.headers.get('Authorization')?.replace('Bearer ', '')
		const { data } = await admin.auth.getUser(token)
		if (!data.user) return json({ error: 'unauthorized' }, 401)
		const delivered = await sendToUser(data.user.id, {
			title: 'Planner',
			body: 'Уведомления работают — так будут приходить напоминания о задачах',
			tag: 'planner-test',
			url: '/i/settings'
		})
		return json({ delivered })
	}

	if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret)
		return json({ error: 'forbidden' }, 403)
	try {
		return json(await runSchedule())
	} catch (error) {
		console.error(error)
		return json({ error: (error as Error).message }, 500)
	}
})
