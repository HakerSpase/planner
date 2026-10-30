import { type ITaskResponse } from '@/types/task.types'

import { desktopBridge, hasServerPush } from './push'

/*
 * Запасной путь для напоминаний, пока планер открыт: в настольном приложении (WebView2)
 * и браузерах без веб-пуша. Если на устройстве включён пуш, его доставит сервер —
 * здесь тогда ничего не делаем, чтобы не было двойных уведомлений.
 */

const SHOWN_KEY = 'planner-local-reminders'
const WINDOW = 2 * 60_000

const readShown = (): Record<string, number> => {
	try {
		return JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}')
	} catch {
		return {}
	}
}

const describe = (offset: number, dueAt: Date) => {
	const time = dueAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
	if (offset === 0) return `Сейчас · ${time}`
	if (offset < 60) return `Через ${offset} мин · в ${time}`
	return `Через ${Math.floor(offset / 60)} ч${offset % 60 ? ` ${offset % 60} мин` : ''} · в ${time}`
}

/** Ближайшие напоминания из задач — для настольного приложения, которое показывает их само */
export function upcomingReminders(tasks: ITaskResponse[] | undefined) {
	const now = Date.now()
	const items: { key: string; title: string; body: string; at: number; due: number }[] = []
	for (const task of tasks || []) {
		if (task.isCompleted || !task.dueAt || !task.reminders?.length) continue
		const dueAt = new Date(task.dueAt)
		for (const offset of task.reminders) {
			const at = dueAt.getTime() - offset * 60_000
			if (at < now - 30 * 60_000 || at > now + 8 * 86_400_000) continue
			items.push({
				key: `${task.id}:${task.dueAt}:${offset}`,
				title: task.name || 'Задача',
				body: describe(offset, dueAt),
				at,
				due: dueAt.getTime()
			})
		}
	}
	return items.sort((a, b) => a.at - b.at).slice(0, 200)
}

/** Передать расписание настольному приложению (если оно это умеет) */
export function syncDesktopReminders(tasks: ITaskResponse[] | undefined) {
	const bridge = desktopBridge()
	if (!bridge?.setReminders || !tasks) return false
	bridge.setReminders(upcomingReminders(tasks)).catch(() => {})
	return true
}

export function watchLocalReminders(
	getTasks: () => ITaskResponse[] | undefined,
	onInAppReminder: (title: string, body: string) => void
) {
	let stopped = false

	const check = async () => {
		if (stopped) return
		if (await hasServerPush().catch(() => false)) return
		// Новое настольное приложение показывает напоминания само — не дублируем
		if (desktopBridge()?.setReminders) return
		const now = Date.now()
		const shown = readShown()
		let changed = false
		for (const task of getTasks() || []) {
			if (task.isCompleted || !task.dueAt || !task.reminders?.length) continue
			const dueAt = new Date(task.dueAt)
			for (const offset of task.reminders) {
				const fireAt = dueAt.getTime() - offset * 60_000
				const key = `${task.id}:${task.dueAt}:${offset}`
				if (fireAt > now || fireAt < now - WINDOW || shown[key]) continue
				shown[key] = now
				changed = true
				const title = task.name || 'Задача'
				const body = describe(offset, dueAt)
				if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
					try {
						new Notification(title, { body, icon: '/planner-icon-192.png', tag: key })
					} catch {
						onInAppReminder(title, body)
					}
				} else onInAppReminder(title, body)
			}
		}
		if (changed) {
			// Старые отметки (больше суток) не храним
			for (const [key, at] of Object.entries(shown)) if (now - at > 86_400_000) delete shown[key]
			try {
				localStorage.setItem(SHOWN_KEY, JSON.stringify(shown))
			} catch {}
		}
	}

	check()
	const timer = setInterval(check, 20_000)
	return () => {
		stopped = true
		clearInterval(timer)
	}
}
