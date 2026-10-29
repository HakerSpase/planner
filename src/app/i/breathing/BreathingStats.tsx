'use client'

import cn from 'clsx'
import { useMemo } from 'react'

import { dateKeyInTimeZone } from '@/lib/time-zone'

import type { IBreathingSession } from '@/services/breathing.service'

const DAY_MS = 24 * 60 * 60 * 1000
const CHART_DAYS = 14

interface IBreathingStats {
	sessions: IBreathingSession[]
	timeZone: string
	isLoading?: boolean
}

export interface IBreathingSummary {
	todayMinutes: number
	weekMinutes: number
	streak: number
	totalSessions: number
	totalMinutes: number
	days: { key: string; date: Date; minutes: number }[]
}

const toMinutes = (seconds: number) => Math.round(seconds / 60)

export function summarizeBreathing(
	sessions: IBreathingSession[],
	timeZone: string,
	now = new Date()
): IBreathingSummary {
	const secondsByDay = new Map<string, number>()
	for (const session of sessions) {
		if (!session.created_at) continue
		const key = dateKeyInTimeZone(new Date(session.created_at), timeZone)
		secondsByDay.set(key, (secondsByDay.get(key) || 0) + session.duration_seconds)
	}

	// Ключи последних N дней, от старого к сегодняшнему
	const lastDays = (count: number) =>
		Array.from({ length: count }, (_, index) => {
			const date = new Date(now.getTime() - (count - 1 - index) * DAY_MS)
			return { key: dateKeyInTimeZone(date, timeZone), date }
		})

	const todayKey = dateKeyInTimeZone(now, timeZone)
	const week = lastDays(7)

	// Серия: подряд идущие дни с практикой; если сегодня ещё не дышали — считаем со вчера
	let streak = 0
	for (let index = 0; index < 366; index++) {
		const key = dateKeyInTimeZone(new Date(now.getTime() - index * DAY_MS), timeZone)
		if (secondsByDay.has(key)) streak++
		else if (index > 0 || key !== todayKey) break
	}

	return {
		todayMinutes: toMinutes(secondsByDay.get(todayKey) || 0),
		weekMinutes: toMinutes(
			week.reduce((sum, day) => sum + (secondsByDay.get(day.key) || 0), 0)
		),
		streak,
		totalSessions: sessions.length,
		totalMinutes: toMinutes(
			sessions.reduce((sum, session) => sum + session.duration_seconds, 0)
		),
		days: lastDays(CHART_DAYS).map(day => ({
			...day,
			minutes: (secondsByDay.get(day.key) || 0) / 60
		}))
	}
}

const plural = (value: number, one: string, few: string, many: string) => {
	const mod10 = value % 10
	const mod100 = value % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}

export function BreathingStats({ sessions, timeZone, isLoading }: IBreathingStats) {
	const summary = useMemo(
		() => summarizeBreathing(sessions, timeZone),
		[sessions, timeZone]
	)
	const maxMinutes = Math.max(5, ...summary.days.map(day => day.minutes))

	const cells = [
		{ label: 'Сегодня', value: summary.todayMinutes, unit: 'мин' },
		{ label: '7 дней', value: summary.weekMinutes, unit: 'мин' },
		{
			label: 'Серия',
			value: summary.streak,
			unit: plural(summary.streak, 'день', 'дня', 'дней')
		},
		{
			label: 'Всего',
			value: summary.totalSessions,
			unit: plural(summary.totalSessions, 'сеанс', 'сеанса', 'сеансов')
		}
	]

	return (
		<section
			aria-label='Статистика дыхания'
			className={cn(
				'grid border border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]',
				isLoading && 'opacity-50'
			)}
		>
			<div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2'>
				{cells.map((cell, index) => (
					<div
						key={cell.label}
						className={cn(
							'border-border px-4 py-4 sm:px-5',
							index % 2 === 0 && 'border-r',
							index < 2 && 'border-b sm:border-b-0 lg:border-b',
							'sm:[&:nth-child(2)]:border-r lg:[&:nth-child(2)]:border-r-0'
						)}
					>
						<p className='eyebrow'>{cell.label}</p>
						<p className='mt-2 flex items-baseline gap-1.5'>
							<span className='text-3xl font-light tabular-nums tracking-tight text-fg'>
								{cell.value}
							</span>
							<span className='text-xs text-subtle'>{cell.unit}</span>
						</p>
					</div>
				))}
			</div>

			<div className='flex flex-col border-t border-border px-4 py-4 sm:px-5 lg:border-l lg:border-t-0'>
				<div className='flex items-baseline justify-between'>
					<p className='eyebrow'>14 дней</p>
					<p className='font-mono text-2xs text-subtle'>
						{summary.totalMinutes} мин за всё время
					</p>
				</div>
				<div className='mt-4 flex h-24 flex-1 items-end gap-1'>
					{summary.days.map((day, index) => {
						const isToday = index === summary.days.length - 1
						const height = day.minutes
							? Math.max(6, (day.minutes / maxMinutes) * 100)
							: 0
						return (
							<div
								key={day.key}
								className='group relative flex h-full flex-1 flex-col justify-end'
								title={`${day.date.toLocaleDateString('ru-RU', {
									day: 'numeric',
									month: 'long'
								})}: ${Math.round(day.minutes)} мин`}
							>
								{height > 0 ? (
									<div
										className={cn(
											'w-full transition-colors',
											isToday ? 'bg-primary' : 'bg-white/20 group-hover:bg-white/35'
										)}
										style={{ height: `${height}%` }}
									/>
								) : (
									<div className='h-px w-full bg-white/15' />
								)}
							</div>
						)
					})}
				</div>
				<div className='mt-2 flex gap-1 font-mono text-[9px] uppercase text-subtle'>
					{summary.days.map((day, index) => (
						<span
							key={day.key}
							className={cn(
								'flex-1 text-center',
								index === summary.days.length - 1 && 'text-fg'
							)}
						>
							{day.date
								.toLocaleDateString('ru-RU', { weekday: 'short', timeZone })
								.slice(0, 2)}
						</span>
					))}
				</div>
			</div>
		</section>
	)
}
