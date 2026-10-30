import { useEffect, useRef } from 'react'

import { type ITaskResponse } from '@/types/task.types'

import { nativePlugin } from './native'
import { flashcardsService, isDue } from '@/services/flashcards.service'

/*
 * Виджеты Android-приложения: «Серия» и «Сегодня». Сам виджет сайт не открывает —
 * пока планер запущен, он передаёт системе короткую сводку, а виджет её рисует.
 */

export interface IWidgetSnapshot {
	/** День сводки по часам телефона — виджет сверяет его с сегодняшним */
	date: string
	streak: number
	todayActive: boolean
	/** 7 дней, от шести дней назад до сегодня */
	week: boolean[]
	best: number
	tasksDone: number
	tasksTotal: number
	overdue: number
	nextTitle: string
	nextTime: string
	cardsDue: number
	updatedAt: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const dayKey = (date: Date) =>
	`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const shiftDays = (date: Date, days: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

async function loadActivity(today: Date) {
	const start = dayKey(shiftDays(today, -120))
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	const response = await fetch(
		`/api/user/activity?start=${start}&end=${dayKey(today)}&timeZone=${encodeURIComponent(timeZone)}`,
		{ cache: 'no-store' }
	)
	if (!response.ok) throw new Error('activity')
	return (await response.json()) as Record<string, number>
}

/** Серия считается так же, как на главной: сегодня пусто — со вчерашнего дня */
function streakFrom(counts: Record<string, number>, today: Date) {
	let cursor = today
	if (!counts[dayKey(cursor)]) cursor = shiftDays(cursor, -1)
	let streak = 0
	while (counts[dayKey(cursor)]) {
		streak++
		cursor = shiftDays(cursor, -1)
	}
	// Лучшая серия за период
	let best = 0
	let run = 0
	for (let i = 120; i >= 0; i--) {
		run = counts[dayKey(shiftDays(today, -i))] ? run + 1 : 0
		best = Math.max(best, run)
	}
	return { streak, best }
}

function taskSummary(tasks: ITaskResponse[], now: Date) {
	const today = dayKey(now)
	let tasksDone = 0
	let tasksTotal = 0
	let overdue = 0
	let next: ITaskResponse | null = null
	for (const task of tasks) {
		const day = task.createdAt ? dayKey(new Date(task.createdAt)) : ''
		if (day === today) {
			tasksTotal++
			if (task.isCompleted) tasksDone++
		} else if (day && day < today && !task.isCompleted) overdue++
		if (
			!task.isCompleted &&
			task.dueAt &&
			new Date(task.dueAt).getTime() > now.getTime() &&
			(!next || new Date(task.dueAt) < new Date(next.dueAt!))
		)
			next = task
	}
	let nextTime = ''
	if (next?.dueAt) {
		const due = new Date(next.dueAt)
		const time = `${pad(due.getHours())}:${pad(due.getMinutes())}`
		const diff = Math.round(
			(shiftDays(due, 0).getTime() - shiftDays(now, 0).getTime()) / 86_400_000
		)
		nextTime =
			diff === 0
				? time
				: diff === 1
					? `завтра ${time}`
					: `${due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${time}`
	}
	return {
		tasksDone,
		tasksTotal,
		overdue,
		nextTitle: next?.name || '',
		nextTime
	}
}

/** Пока планер открыт в Android-приложении — держим виджеты в актуальном виде */
export function useWidgetSync(tasks: ITaskResponse[] | undefined) {
	const tasksRef = useRef(tasks)
	tasksRef.current = tasks
	const lastSent = useRef('')
	const timer = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		const widget = nativePlugin('PlannerWidget')
		if (!widget) return

		const sync = async () => {
			const list = tasksRef.current
			if (!list) return
			const now = new Date()
			const today = shiftDays(now, 0)
			const [counts, deck] = await Promise.all([
				loadActivity(today).catch(() => null),
				flashcardsService.getDeck().catch(() => null)
			])
			if (!counts) return
			const { streak, best } = streakFrom(counts, today)
			const snapshot: IWidgetSnapshot = {
				date: dayKey(today),
				streak,
				best,
				todayActive: Boolean(counts[dayKey(today)]),
				week: Array.from({ length: 7 }, (_, i) =>
					Boolean(counts[dayKey(shiftDays(today, i - 6))])
				),
				...taskSummary(list, now),
				cardsDue: (deck || []).filter(card => isDue(card)).length,
				updatedAt: Date.now()
			}
			const { updatedAt: _skip, ...comparable } = snapshot
			const signature = JSON.stringify(comparable)
			if (signature === lastSent.current) return
			lastSent.current = signature
			await widget.update({ snapshot: JSON.stringify(snapshot) }).catch(() => {
				lastSent.current = ''
			})
		}

		const schedule = () => {
			clearTimeout(timer.current)
			timer.current = setTimeout(() => void sync(), 1500)
		}
		schedule()
		const onVisible = () => document.visibilityState === 'visible' && schedule()
		document.addEventListener('visibilitychange', onVisible)
		const interval = setInterval(schedule, 10 * 60_000)
		window.addEventListener('planner:widget-sync', schedule)
		return () => {
			clearTimeout(timer.current)
			clearInterval(interval)
			document.removeEventListener('visibilitychange', onVisible)
			window.removeEventListener('planner:widget-sync', schedule)
		}
	}, [])

	// Задачи поменялись — пересчитать
	useEffect(() => {
		if (tasks) window.dispatchEvent(new Event('planner:widget-sync'))
	}, [tasks])
}
