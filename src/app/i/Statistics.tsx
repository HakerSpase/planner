'use client'

import Loader from '@/components/ui/Loader'

import { useProfile } from '@/hooks/useProfile'

const STATISTIC_LABELS: Record<string, string> = {
	Total: 'Всего задач',
	'Completed tasks': 'Выполненных задач',
	'Today tasks': 'Задач на сегодня',
	'Week tasks': 'Задач за неделю'
}

export function Statistics() {
	const { data, isLoading } = useProfile()

	return isLoading ? (
		<Loader />
	) : (
		<div className='grid grid-cols-4 gap-12 mt-7'>
			{data?.statistics.length ? (
				data.statistics.map(statistic => (
					<div
						className='bg-border/5 rounded p-layout text-center hover:-translate-y-3 transition-transform duration-500'
						key={statistic.label}
					>
						<div className='text-xl'>
							{STATISTIC_LABELS[statistic.label] || statistic.label}
						</div>
						<div className='text-3xl font-semibold'>{statistic.value}</div>
					</div>
				))
			) : (
				<div>Статистика не загружена</div>
			)}
		</div>
	)
}
