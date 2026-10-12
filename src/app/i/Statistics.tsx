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
		<div className='mt-5 grid min-w-0 grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4'>
			{data?.statistics.length ? (
				data.statistics.map((statistic, index) => {
					const Icon = STATISTIC_ICONS[index] || ListTodo
					return (
						<div
							className='flex min-h-24 min-w-0 items-start justify-between gap-2 border border-white/[0.08] bg-[#141516] p-3 sm:min-h-28 sm:p-4'
							key={statistic.label}
						>
							<div className='min-w-0'>
								<p className='break-words text-xs leading-4 text-white/55 sm:text-sm'>
									{STATISTIC_LABELS[statistic.label] || statistic.label}
								</p>
								<p className='mt-2 text-2xl font-semibold tabular-nums tracking-tight text-white/95 sm:text-3xl'>
									{statistic.value}
								</p>
							</div>
							<span className='shrink-0 border-l border-primary/40 pl-2 text-primary/80'>
								<Icon size={16} />
							</span>
						</div>
					)
				})
			) : (
				<div>Статистика не загружена</div>
			)}
		</div>
	)
}
