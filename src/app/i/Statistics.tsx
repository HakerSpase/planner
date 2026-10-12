'use client'

import Loader from '@/components/ui/Loader'
import { CalendarDays, CheckCircle2, ListTodo, TrendingUp } from 'lucide-react'

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
		<div className='mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4'>
			{data?.statistics.length ? (
				data.statistics.map((statistic, index) => (
					<div
						className='group flex min-h-28 items-start justify-between rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#18191b] to-[#121314] p-5 transition-colors hover:border-white/[0.13]'
						key={statistic.label}
					>
						<div>
							<p className='text-sm text-white/50'>
								{STATISTIC_LABELS[statistic.label] || statistic.label}
							</p>
							<p className='mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white/95'>{statistic.value}</p>
						</div>
						<span className='rounded-xl bg-primary/[0.09] p-2.5 text-primary/80 transition-colors group-hover:bg-primary/[0.15]'>
							{(() => {
								const Icon = STATISTIC_ICONS[index] || ListTodo
								return <Icon size={18} />
							})()}
						</span>
					</div>
				))
			) : (
				<div>Статистика не загружена</div>
			)}
		</div>
	)
}
