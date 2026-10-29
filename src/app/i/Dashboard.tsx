'use client'

import { useQuery } from '@tanstack/react-query'
import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { DASHBOARD_PAGES } from '@/config/pages-url.config'

import type { ITaskResponse } from '@/types/task.types'

import { useProfile } from '@/hooks/useProfile'

import { useLoadSettings } from './timer/hooks/useLoadSettings'
import { useTasks } from './tasks/hooks/useTasks'
import { useUpdateTask } from './tasks/hooks/useUpdateTask'
import { useTimeBlocks } from './time-blocking/hooks/useTimeBlocks'
import { pomodoroService } from '@/services/pomodoro.service'

const greeting = (hour: number) =>
	hour < 5
		? 'Доброй ночи'
		: hour < 12
			? 'Доброе утро'
			: hour < 18
				? 'Добрый день'
				: 'Добрый вечер'

const formatMinutes = (minutes: number) => {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	return h ? `${h} ч${m ? ` ${m} мин` : ''}` : `${m} мин`
}

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
	const { updateTask } = useUpdateTask()
	const { items: timeBlocks } = useTimeBlocks()
	const { workInterval, timeZone } = useLoadSettings()
	const { data: pomodoro } = useQuery({
		queryKey: ['get today session', timeZone],
		queryFn: () => pomodoroService.getTodaySession(timeZone),
		enabled: Boolean(timeZone),
		staleTime: 30000
	})

	const summary = useTaskSummary(tasks)
	const now = dayjs().locale('ru')
	const firstName = profile?.user.name?.split(' ')[0]

	// Сначала просроченные, потом сегодняшние
	const focusTasks = [...summary.overdue, ...summary.dueToday]

	const rounds = pomodoro?.data?.rounds || []
	const roundsDone = rounds.filter(round => round.isCompleted).length
	const plannedMinutes = (timeBlocks || []).reduce(
		(sum, block) => sum + (block.duration || 0),
		0
	)

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

			{/* Ключевые цифры */}
			<section className='grid grid-cols-2 border border-border xl:grid-cols-4'>
				{stats.map((stat, index) => (
					<div
						key={stat.label}
						className={cn(
							'border-border px-4 py-4 sm:px-5 sm:py-5',
							index % 2 === 0 && 'border-r',
							index < 2 && 'border-b xl:border-b-0',
							index === 1 && 'xl:border-r'
						)}
					>
						<p className='eyebrow'>{stat.label}</p>
						<p className='mt-3 text-4xl font-light tabular-nums tracking-tight text-fg'>
							{stat.value}
						</p>
						<p className={cn('mt-1 text-xs text-subtle', stat.tone)}>{stat.note}</p>
					</div>
				))}
			</section>

			<div className='mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]'>
				{/* Фокус дня */}
				<section className='border border-border bg-surface'>
					<PanelHeader
						title='Сегодня'
						meta={
							focusTasks.length
								? `${focusTasks.length} ${focusTasks.length === 1 ? 'задача' : 'задач'}`
								: undefined
						}
						href={DASHBOARD_PAGES.TASKS}
						linkLabel='Все задачи'
					/>
					{!tasks ? (
						<SkeletonRows count={4} />
					) : focusTasks.length === 0 ? (
						<div className='px-5 py-12 text-center'>
							<p className='text-sm text-muted'>На сегодня ничего не запланировано</p>
							<Link
								href={DASHBOARD_PAGES.TASKS}
								className='mt-2 inline-block text-xs text-primary hover:underline'
							>
								Добавить задачу
							</Link>
						</div>
					) : (
						<ul>
							{focusTasks.slice(0, 8).map(task => {
								const isOverdue = dayjs(task.createdAt).isBefore(dayjs().startOf('day'))
								const subtasks = task.subtasks || []
								return (
									<li
										key={task.id}
										className='flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0'
									>
										<button
											type='button'
											aria-label='Отметить выполненной'
											onClick={() =>
												updateTask({ id: task.id, data: { isCompleted: true } })
											}
											className='group grid h-4 w-4 shrink-0 place-items-center border border-white/30 transition-colors hover:border-primary'
										>
											<Check
												size={11}
												strokeWidth={3}
												className='text-primary opacity-0 group-hover:opacity-100'
											/>
										</button>
										<span className='min-w-0 flex-1 truncate text-sm text-fg'>
											{task.name || 'Без названия'}
										</span>
										{subtasks.length > 0 && (
											<span className='shrink-0 font-mono text-2xs text-subtle'>
												{subtasks.filter(subtask => subtask.isCompleted).length}/
												{subtasks.length}
											</span>
										)}
										{isOverdue && (
											<span className='shrink-0 font-mono text-2xs uppercase text-danger'>
												{dayjs(task.createdAt).locale('ru').format('D MMM')}
											</span>
										)}
									</li>
								)
							})}
						</ul>
					)}
				</section>

				<div className='flex flex-col gap-4'>
					{/* Pomodoro */}
					<section className='border border-border bg-surface'>
						<PanelHeader
							title='Фокус'
							href={DASHBOARD_PAGES.TIMER}
							linkLabel='Таймер'
						/>
						<div className='px-5 py-4'>
							{rounds.length ? (
								<>
									<p className='flex items-baseline gap-2'>
										<span className='text-3xl font-light tabular-nums text-fg'>
											{formatMinutes(roundsDone * workInterval)}
										</span>
									</p>
									<p className='mt-1 text-xs text-subtle'>
										{roundsDone} из {rounds.length} раундов
									</p>
									<div className='mt-3 flex gap-1'>
										{rounds.map(round => (
											<span
												key={round.id}
												className={cn(
													'h-1 flex-1',
													round.isCompleted ? 'bg-primary' : 'bg-white/10'
												)}
											/>
										))}
									</div>
								</>
							) : (
								<p className='text-sm text-muted'>
									Сессия не начата.{' '}
									<Link
										href={DASHBOARD_PAGES.TIMER}
										className='text-primary hover:underline'
									>
										Запустить
									</Link>
								</p>
							)}
						</div>
					</section>

					{/* Тайм-блоки */}
					<section className='border border-border bg-surface'>
						<PanelHeader
							title='План дня'
							meta={plannedMinutes ? formatMinutes(plannedMinutes) : undefined}
							href={DASHBOARD_PAGES.TIME_BLOCKING}
							linkLabel='Блоки'
						/>
						{!timeBlocks ? (
							<SkeletonRows count={3} />
						) : timeBlocks.length === 0 ? (
							<p className='px-5 py-4 text-sm text-muted'>Блоков пока нет</p>
						) : (
							<ul>
								{timeBlocks.slice(0, 6).map(block => (
									<li
										key={block.id}
										className='flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0'
									>
										<span
											className='h-3 w-1 shrink-0'
											style={{ backgroundColor: block.color || '#64748b' }}
										/>
										<span className='min-w-0 flex-1 truncate text-sm text-fg'>
											{block.name}
										</span>
										<span className='shrink-0 font-mono text-xs text-subtle'>
											{formatMinutes(block.duration)}
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
			</div>
		</div>
	)
}

function PanelHeader({
	title,
	meta,
	href,
	linkLabel
}: {
	title: string
	meta?: string
	href: string
	linkLabel: string
}) {
	return (
		<header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
			<h2 className='flex items-baseline gap-2 text-sm font-semibold text-fg'>
				{title}
				{meta && <span className='font-mono text-2xs font-normal text-subtle'>{meta}</span>}
			</h2>
			<Link
				href={href}
				className='flex items-center gap-1 font-mono text-2xs uppercase tracking-wider text-subtle transition-colors hover:text-fg'
			>
				{linkLabel}
				<ArrowRight size={12} />
			</Link>
		</header>
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
