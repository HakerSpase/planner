'use client'

import {
	eachDayOfInterval,
	endOfWeek,
	format,
	startOfWeek,
	subDays,
	subMonths,
	subYears
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useProfile } from '@/hooks/useProfile'

import { dateKeyInTimeZone } from '@/lib/time-zone'

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')
const PERIODS = [
	{ value: '7d', label: '7 дней' },
	{ value: '30d', label: '30 дней' },
	{ value: '90d', label: '90 дней' },
	{ value: '6m', label: '6 месяцев' },
	{ value: '1y', label: '1 год' }
]

export function ActivityCalendar() {
	const [counts, setCounts] = useState<Record<string, number>>({})
	const [loading, setLoading] = useState(true)
	const [period, setPeriod] = useState('6m')
	const [chartWidth, setChartWidth] = useState(0)
	const chartRef = useRef<HTMLDivElement>(null)
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
	const todayKey = dayKey(today)
	const rangeStart = useMemo(() => {
		switch (period) {
			case '7d':
				return subDays(today, 6)
			case '90d':
				return subDays(today, 89)
			case '6m':
				return subMonths(today, 6)
			case '1y':
				return subYears(today, 1)
			default:
				return subDays(today, 29)
		}
	}, [today, period])
	const rangeStartKey = dayKey(rangeStart)
	const gridStart = startOfWeek(rangeStart, { weekStartsOn: 1 })
	const gridEnd = endOfWeek(today, { weekStartsOn: 1 })
	const days = useMemo(
		() => eachDayOfInterval({ start: gridStart, end: gridEnd }),
		[gridStart.getTime(), gridEnd.getTime()]
	)
	const weeks = useMemo(() => {
		const result: Date[][] = []
		for (let index = 0; index < days.length; index += 7)
			result.push(days.slice(index, index + 7))
		return result
	}, [days])

	useEffect(() => {
		const element = chartRef.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) =>
			setChartWidth(entry.contentRect.width)
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	const cellSize = Math.min(
		36,
		Math.max(
			3,
			Math.floor(
				(chartWidth - 34 - Math.max(0, weeks.length - 1) * 2) /
					Math.max(1, weeks.length)
			)
		)
	)

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
			? 'bg-[#242629]'
			: count === 1
				? 'bg-[#0e4429]'
				: count <= 3
					? 'bg-[#006d32]'
					: count <= 6
						? 'bg-[#26a641]'
						: 'bg-[#d6e685]'

	return (
		<section
			className='mt-5 min-w-0 border border-white/[0.08] bg-[#141516] p-4 sm:p-5'
			aria-label='Календарь активности'
		>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
				<div>
					<h2 className='text-base font-medium text-white'>Активность</h2>
					<p className='mt-1 text-xs text-white/45'>
						Завершённые задачи и записи в «Мыслях»
					</p>
				</div>
				<div className='flex w-full flex-col gap-2 sm:w-auto sm:items-end'>
					<div className='flex items-center justify-between gap-3 sm:justify-end'>
						<span className='text-xs font-medium text-emerald-300'>
							Сегодня, {format(today, 'd MMMM', { locale: ru })}
						</span>
						{loading && (
							<span className='text-xs text-white/40'>Обновляем…</span>
						)}
					</div>
					<div
						role='group'
						aria-label='Период активности'
						className='grid w-full grid-cols-3 gap-x-3 sm:flex sm:w-auto sm:gap-2'
					>
						{PERIODS.map(option => (
							<button
								key={option.value}
								type='button'
								aria-pressed={period === option.value}
								onClick={() => setPeriod(option.value)}
								className={`min-h-9 border-b-2 px-2 text-left text-xs transition-colors sm:px-3 ${period === option.value ? 'border-b-primary text-white' : 'border-b-transparent text-white/55 hover:text-white/85'}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>
			</div>

			<div
				ref={chartRef}
				className='mt-5 w-full min-w-0 overflow-x-auto pb-2'
			>
				<div className='w-max'>
					<div className='mb-2 flex gap-2'>
						<span
							className='w-[26px] shrink-0'
							aria-hidden='true'
						/>
						<div
							className='grid gap-0.5 text-[9px] text-white/45'
							style={{
								gridTemplateColumns: `repeat(${weeks.length}, ${cellSize}px)`
							}}
						>
							{weeks.map((week, index) => (
								<span
									key={index}
									className='truncate'
								>
									{week.find(day => day.getDate() === 1)
										? format(
												week.find(day => day.getDate() === 1)!,
												'LLL',
												{ locale: ru }
											)
										: ''}
								</span>
							))}
						</div>
					</div>
					<div className='flex gap-2'>
						<div className='grid w-[26px] shrink-0 grid-rows-7 gap-0.5 text-[9px] leading-none text-white/40'>
							{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
								<span
									key={day}
									className='flex items-center'
									style={{ height: `${cellSize}px` }}
								>
									{day}
								</span>
							))}
						</div>
						<div
							className='grid grid-flow-col grid-rows-7 gap-0.5'
							style={{
								gridTemplateColumns: `repeat(${weeks.length}, ${cellSize}px)`,
								gridTemplateRows: `repeat(7, ${cellSize}px)`
							}}
						>
							{weeks.flatMap(week =>
								week.map(day => {
									const key = dayKey(day)
									const isInRange = key >= rangeStartKey && key <= todayKey
									const isToday = key === todayKey
									const count = isInRange ? counts[key] || 0 : 0
									return (
										<span
											key={key}
											title={
												isInRange
													? `${isToday ? 'Сегодня, ' : ''}${format(day, 'd MMMM yyyy', { locale: ru })}: ${count} ${count === 1 ? 'событие' : 'событий'}`
													: undefined
											}
											aria-label={
												isInRange
													? `${isToday ? 'Сегодня, ' : ''}${format(day, 'd MMMM yyyy', { locale: ru })}: ${count} событий`
													: undefined
											}
											className={`z-0 block transition-colors ${isInRange ? intensity(count) : 'bg-transparent'} ${isToday ? 'z-10 bg-emerald-500/50 outline outline-2 outline-emerald-300 outline-offset-1' : ''}`}
											style={{ width: cellSize, height: cellSize }}
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
						className={`h-3 w-3 ${intensity(value)}`}
					/>
				))}
				<span>Больше</span>
			</div>
		</section>
	)
}
