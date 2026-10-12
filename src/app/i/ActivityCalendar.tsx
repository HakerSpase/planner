'use client'

import {
	eachDayOfInterval,
	endOfWeek,
	format,
	startOfWeek,
	subDays
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'

import { useProfile } from '@/hooks/useProfile'

import { dateKeyInTimeZone } from '@/lib/time-zone'

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')

export function ActivityCalendar() {
	const [counts, setCounts] = useState<Record<string, number>>({})
	const [loading, setLoading] = useState(true)
	const { data: profile } = useProfile()
	const deviceTimeZone = useMemo(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
		[]
	)
	const timeZone = profile?.user.timeZone || deviceTimeZone
	const today = useMemo(() => {
		const [year, month, day] = dateKeyInTimeZone(new Date(), timeZone)
			.split('-')
			.map(Number)
		return new Date(year, month - 1, day)
	}, [timeZone])
	const rangeStart = useMemo(
		() => startOfWeek(subDays(today, 363), { weekStartsOn: 1 }),
		[today]
	)
	const days = useMemo(
		() =>
			eachDayOfInterval({
				start: rangeStart,
				end: endOfWeek(today, { weekStartsOn: 1 })
			}),
		[rangeStart, today]
	)
	const rangeStartKey = dayKey(rangeStart)
	const todayKey = dayKey(today)
	const weeks = useMemo(() => {
		const result: Date[][] = []
		for (let index = 0; index < days.length; index += 7)
			result.push(days.slice(index, index + 7))
		return result
	}, [days])

	useEffect(() => {
		let active = true
		setLoading(true)
		fetch(
			`/api/user/activity?start=${rangeStartKey}&end=${todayKey}&timeZone=${encodeURIComponent(timeZone)}`,
			{ cache: 'no-store' }
		)
			.then(async response => {
				if (!response.ok) throw new Error()
				return response.json()
			})
			.then((data: Record<string, number>) => active && setCounts(data))
			.catch(() => active && setCounts({}))
			.finally(() => active && setLoading(false))
		return () => {
			active = false
		}
	}, [rangeStartKey, todayKey, timeZone])

	const intensity = (count: number) =>
		count === 0
			? 'bg-white/[0.06]'
			: count === 1
				? 'bg-emerald-950'
				: count <= 3
					? 'bg-emerald-800'
					: count <= 6
						? 'bg-emerald-600'
						: 'bg-emerald-400'

	return (
		<section
			className='mt-5 border border-white/[0.08] bg-[#141516] p-4 sm:p-5'
			aria-label='Календарь активности'
		>
			<div className='flex flex-wrap items-end justify-between gap-2'>
				<div>
					<h2 className='text-base font-medium text-white'>
						Активность за год
					</h2>
					<p className='mt-1 text-xs text-white/45'>
						Завершённые задачи и записи в «Мыслях»
					</p>
				</div>
				<span className='text-xs text-white/40'>
					{loading ? 'Загружаем…' : timeZone.replaceAll('_', ' ')}
				</span>
			</div>
			<div className='mt-4 overflow-x-auto pb-2'>
				<div className='min-w-[700px]'>
					<div
						className='mb-2 grid gap-1 pl-8 text-[10px] text-white/45'
						style={{
							gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`
						}}
					>
						{weeks.map((week, index) => (
							<span key={index}>
								{week[0].getDate() <= 7
									? format(week[0], 'LLL', { locale: ru })
									: ''}
							</span>
						))}
					</div>
					<div className='flex gap-2'>
						<div className='grid shrink-0 grid-rows-7 gap-1 pt-0.5 text-[9px] leading-[11px] text-white/35'>
							{['Пн', '', 'Ср', '', 'Пт', '', ''].map((label, index) => (
								<span
									key={index}
									className='h-[11px]'
								>
									{label}
								</span>
							))}
						</div>
						<div
							className='grid flex-1 grid-flow-col grid-rows-7 gap-1'
							style={{
								gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`
							}}
						>
							{weeks.flatMap(week =>
								week.map(day => {
									const key = dayKey(day)
									const count = counts[key] || 0
									return (
										<span
											key={key}
											title={`${format(day, 'd MMMM yyyy', { locale: ru })}: ${count} ${count === 1 ? 'событие' : 'событий'}`}
											className={`h-[11px] min-w-0 transition-colors ${intensity(count)} ${key === dayKey(today) ? 'outline outline-1 outline-emerald-300' : ''}`}
										/>
									)
								})
							)}
						</div>
					</div>
				</div>
			</div>
			<div className='mt-2 flex items-center justify-end gap-1.5 text-[10px] text-white/40'>
				<span>Меньше</span>
				{[0, 1, 2, 4, 7].map(value => (
					<span
						key={value}
						className={`h-[11px] w-[11px] ${intensity(value)}`}
					/>
				))}
				<span>Больше</span>
			</div>
		</section>
	)
}
