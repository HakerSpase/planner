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
/** Выполненные сегодня задачи по данным на телефоне — сервер мог ещё не записать отметку */
function completedToday(tasks: ITaskResponse[], now: Date) {
	const today = dayKey(now)
	return tasks.filter(
		task =>
			task.isCompleted &&
			// только что отмеченная: время выполнения ещё не пришло с сервера
			(!task.completedAt || dayKey(new Date(task.completedAt)) === today)
	).length
}

function buildSnapshot(
	tasks: ITaskResponse[],
	serverCounts: Record<string, number>,
	cardsDue: number
): IWidgetSnapshot {
	const now = new Date()
	const today = shiftDays(now, 0)
	const key = dayKey(today)
	// Сегодняшнюю активность дополняем тем, что видно на телефоне прямо сейчас
	const counts = {
		...serverCounts,
		[key]: Math.max(serverCounts[key] || 0, completedToday(tasks, now))
	}
	const { streak, best } = streakFrom(counts, today)
	return {
		date: key,
		streak,
		best,
		todayActive: Boolean(counts[key]),
		week: Array.from({ length: 7 }, (_, i) =>
			Boolean(counts[dayKey(shiftDays(today, i - 6))])
		),
		...taskSummary(tasks, now),
		cardsDue,
		updatedAt: Date.now()
	}
}

/** Пока планер открыт в Android-приложении — держим виджеты в актуальном виде */
export function useWidgetSync(tasks: ITaskResponse[] | undefined) {
	const tasksRef = useRef(tasks)
	tasksRef.current = tasks
	const lastSent = useRef('')
	// Серия с сервера и карточки — грузятся в фоне; виджет обновляется сразу, не дожидаясь их
	const countsRef = useRef<Record<string, number> | null>(null)
	const cardsRef = useRef(0)
	const pushRef = useRef<() => void>(() => {})
	const refreshRef = useRef<() => void>(() => {})

	useEffect(() => {
		const widget = nativePlugin('PlannerWidget')
		if (!widget) return

		const push = () => {
			const list = tasksRef.current
			if (!list || !countsRef.current) return
			const snapshot = buildSnapshot(list, countsRef.current, cardsRef.current)
			const { updatedAt: _skip, ...comparable } = snapshot
			const signature = JSON.stringify(comparable)
			if (signature === lastSent.current) return
			lastSent.current = signature
			widget.update({ snapshot: JSON.stringify(snapshot) }).catch(() => {
				lastSent.current = ''
			})
		}
		pushRef.current = push

		let loading = false
		const refresh = async () => {
			if (loading) return
			loading = true
			try {
				const [counts, deck] = await Promise.all([
					loadActivity(shiftDays(new Date(), 0)).catch(() => null),
					flashcardsService.getDeck().catch(() => null)
				])
				if (counts) countsRef.current = counts
				if (deck) cardsRef.current = deck.filter(card => isDue(card)).length
				push()
			} finally {
				loading = false
			}
		}

		refreshRef.current = () => void refresh()
		void refresh()
		// Свернули приложение — отправить сразу: в фоне таймеры Android замирают
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') push()
			else void refresh()
		}
		document.addEventListener('visibilitychange', onVisibility)
		window.addEventListener('pagehide', push)
		const interval = setInterval(() => void refresh(), 10 * 60_000)
		return () => {
			clearInterval(interval)
			document.removeEventListener('visibilitychange', onVisibility)
			window.removeEventListener('pagehide', push)
		}
	}, [])

	// Задачи поменялись — виджет обновляется сразу, а серия с сервера — чуть позже
	useEffect(() => {
		if (!tasks) return
		pushRef.current()
		const later = setTimeout(() => refreshRef.current(), 4000)
		return () => clearTimeout(later)
	}, [tasks])
}
