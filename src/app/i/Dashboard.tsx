'use client'

import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { useMemo } from 'react'

import type { ITaskResponse } from '@/types/task.types'

import { useProfile } from '@/hooks/useProfile'

import { useTasks } from './tasks/hooks/useTasks'

const greeting = (hour: number) =>
	hour < 5
		? 'Доброй ночи'
		: hour < 12
			? 'Доброе утро'
			: hour < 18
				? 'Добрый день'
				: 'Добрый вечер'

/* Цифры по задачам: считаем на клиенте из списка, чтобы можно было сравнить недели */
function useTaskSummary(tasks: ITaskResponse[] | undefined) {
	return useMemo(() => {
		const today = dayjs().startOf('day')
		const weekAgo = today.subtract(6, 'day')
		const twoWeeksAgo = today.subtract(13, 'day')
		const active = (tasks || []).filter(task => !task.isCompleted)
		const doneIn = (from: dayjs.Dayjs, to: dayjs.Dayjs) =>
			(tasks || []).filter(task => {
				if (!task.isCompleted || !task.completedAt) return false
				const d = dayjs(task.completedAt)
				return !d.isBefore(from) && d.isBefore(to)
			}).length

		const overdue = active.filter(
			task => task.createdAt && dayjs(task.createdAt).isBefore(today)
		)
		const dueToday = active.filter(
			task => task.createdAt && dayjs(task.createdAt).isSame(today, 'day')
		)
		const thisWeek = doneIn(weekAgo, today.add(1, 'day'))
		const lastWeek = doneIn(twoWeeksAgo, weekAgo)

		return {
			active: active.length,
			overdue,
			dueToday,
			thisWeek,
			delta: thisWeek - lastWeek
		}
	}, [tasks])
}

export function Dashboard() {
	const { data: profile } = useProfile()
	const { items: tasks } = useTasks()

	const summary = useTaskSummary(tasks)
	const now = dayjs().locale('ru')
	const firstName = profile?.user.name?.split(' ')[0]

	// Выполненные задачи по дням за последние 14 дней
	const days = useMemo(() => {
		const today = dayjs().startOf('day')
		return Array.from({ length: 14 }, (_, index) => {
			const day = today.subtract(13 - index, 'day')
			const count = (tasks || []).filter(
				task =>
					task.isCompleted &&
					task.completedAt &&
					dayjs(task.completedAt).isSame(day, 'day')
			).length
			return { day, count }
		})
	}, [tasks])
	const maxCount = Math.max(3, ...days.map(item => item.count))
	const totalDone = days.reduce((sum, item) => sum + item.count, 0)

	const stats = [
		{
			label: 'На сегодня',
			value: summary.dueToday.length,
			note: summary.dueToday.length ? 'задач в плане' : 'день свободен'
		},
		{
			label: 'Просрочено',
			value: summary.overdue.length,
			note: summary.overdue.length ? 'стоит разобрать' : 'всё вовремя',
			tone: summary.overdue.length ? 'text-danger' : undefined
		},
		{
			label: 'Выполнено за 7 дней',
			value: summary.thisWeek,
			note:
				summary.delta === 0
					? 'как на прошлой неделе'
					: `${summary.delta > 0 ? '+' : '−'}${Math.abs(summary.delta)} к прошлой неделе`,
			tone: summary.delta > 0 ? 'text-success' : undefined
		},
		{
			label: 'В работе',
			value: summary.active,
			note: 'активных задач'
		}
	]

	return (
		<div>
			<header className='mb-6 border-b border-border pb-5 sm:mb-8 sm:pb-6'>
				<p className='eyebrow first-letter:uppercase'>
					{now.format('dddd, D MMMM')}
				</p>
				<h1 className='mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-4xl'>
					{greeting(now.hour())}
					{firstName ? `, ${firstName}` : ''}
				</h1>
			</header>

			<div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
				{/* Ключевые цифры */}
				<section className='grid grid-cols-2 border border-border bg-surface'>
					{stats.map((stat, index) => (
						<div
							key={stat.label}
							className={cn(
								'border-border px-4 py-4 sm:px-5 sm:py-5',
								index % 2 === 0 && 'border-r',
								index < 2 && 'border-b'
							)}
						>
							<p className='eyebrow'>{stat.label}</p>
							<p className='mt-3 text-4xl font-light tabular-nums tracking-tight text-fg'>
								{tasks ? stat.value : '–'}
							</p>
							<p className={cn('mt-1 text-xs text-subtle', stat.tone)}>{stat.note}</p>
						</div>
					))}
				</section>

				{/* Небольшой график: выполнено по дням */}
				<section className='flex flex-col border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5'>
					<div className='flex items-baseline justify-between gap-3'>
						<p className='eyebrow'>Выполнено · 14 дней</p>
						<p className='font-mono text-xs tabular-nums text-muted'>{totalDone}</p>
					</div>
					<div className='mt-5 flex min-h-[8rem] flex-1 items-end gap-1.5'>
						{days.map(({ day, count }, index) => {
							const isToday = index === days.length - 1
							return (
								<div
									key={day.valueOf()}
									title={`${day.locale('ru').format('D MMMM')}: ${count}`}
									className='group flex h-full flex-1 flex-col justify-end'
								>
									{count > 0 && (
										<span className='mb-1 text-center font-mono text-[10px] text-subtle opacity-0 transition-opacity group-hover:opacity-100'>
											{count}
										</span>
									)}
									<div
										className={cn(
											'w-full transition-colors',
											count === 0
												? 'h-px bg-white/15'
												: isToday
													? 'bg-primary'
													: 'bg-white/20 group-hover:bg-white/35'
										)}
										style={count ? { height: `${Math.max(8, (count / maxCount) * 100)}%` } : undefined}
									/>
								</div>
							)
						})}
					</div>
					<div className='mt-2 flex gap-1.5 font-mono text-[9px] uppercase text-subtle'>
						{days.map(({ day }, index) => (
							<span
								key={day.valueOf()}
								className={cn('flex-1 text-center', index === days.length - 1 && 'text-fg')}
							>
								{day.locale('ru').format('dd')}
							</span>
						))}
					</div>
				</section>
			</div>
		</div>
	)
}

export function SkeletonRows({ count }: { count: number }) {
	return (
		<div aria-hidden>
			{Array.from({ length: count }, (_, index) => (
				<div
					key={index}
					className='flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0'
				>
					<span className='h-4 w-4 shrink-0 bg-white/[0.05]' />
					<span
						className='h-3 animate-pulse bg-white/[0.05]'
						style={{ width: `${45 + ((index * 17) % 40)}%` }}
					/>
				</div>
			))}
		</div>
	)
}
