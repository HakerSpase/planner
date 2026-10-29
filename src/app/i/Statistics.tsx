'use client'

import { CalendarDays, CheckCircle2, ListTodo, TrendingUp } from 'lucide-react'

import Loader from '@/components/ui/Loader'

import { useProfile } from '@/hooks/useProfile'

const STATISTIC_LABELS: Record<string, string> = {
	Total: 'Всего задач',
	'Completed tasks': 'Выполненных задач',
	'Today tasks': 'Задач на сегодня',
	'Week tasks': 'Задач за неделю'
}

const STATISTIC_ICONS = [ListTodo, CheckCircle2, CalendarDays, TrendingUp]

export function Statistics() {
	const { data, isLoading } = useProfile()

	return isLoading ? (
		<Loader />
	) : (
		<div className='grid min-w-0 grid-cols-2 gap-px border border-border bg-border xl:grid-cols-4'>
			{data?.statistics.length ? (
				data.statistics.map((statistic, index) => {
					const Icon = STATISTIC_ICONS[index] || ListTodo
					return (
						<div
							className='flex min-w-0 flex-col gap-4 bg-bg p-4 transition-colors hover:bg-surface sm:p-5'
							key={statistic.label}
						>
							<span className='grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary'>
								<Icon size={16} />
							</span>
							<div className='min-w-0'>
								<p className='text-3xl font-semibold tabular-nums tracking-tight text-fg'>
									{statistic.value}
								</p>
								<p className='mt-0.5 break-words text-sm text-muted'>
									{STATISTIC_LABELS[statistic.label] || statistic.label}
								</p>
							</div>
						</div>
					)
				})
			) : (
				<div className='text-sm text-subtle'>Статистика не загружена</div>
			)}
		</div>
	)
}
