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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

	// Mouse drag-to-scroll state & refs (supports right-click and left-click)
	const isMouseDownRef = useRef(false)
	const mouseButtonRef = useRef<number | null>(null)
	const startXRef = useRef(0)
	const startScrollLeftRef = useRef(0)
	const hasDraggedRef = useRef(false)
	const [isDragging, setIsDragging] = useState(false)

	// Sleek auto-fading scrollbar indicator state
	const [scrollState, setScrollState] = useState({
		scrollLeft: 0,
		scrollWidth: 0,
		clientWidth: 0
	})
	const [isScrollbarVisible, setIsScrollbarVisible] = useState(false)
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
	const ninetyDayWeekCount =
		(Math.round(
			(endOfWeek(today, { weekStartsOn: 1 }).getTime() -
				startOfWeek(subDays(today, 89), { weekStartsOn: 1 }).getTime()) /
				(7 * 24 * 60 * 60 * 1000)
		) || 0) + 1

	// Update scroll dimensions for custom fading scrollbar
	const updateScrollState = useCallback(() => {
		const el = chartRef.current
		if (!el) return
		setScrollState({
			scrollLeft: el.scrollLeft,
			scrollWidth: el.scrollWidth,
			clientWidth: el.clientWidth
		})
	}, [])

	const showScrollbarTemporarily = useCallback(() => {
		setIsScrollbarVisible(true)
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current)
		}
		scrollTimeoutRef.current = setTimeout(() => {
			setIsScrollbarVisible(false)
		}, 1200)
	}, [])

	const handleScroll = useCallback(() => {
		updateScrollState()
		showScrollbarTemporarily()
	}, [updateScrollState, showScrollbarTemporarily])

	useEffect(() => {
		const element = chartRef.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			setChartWidth(entry.contentRect.width)
			updateScrollState()
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [updateScrollState])

	// Auto-scroll to the right (to today) on mount or when period changes
	useEffect(() => {
		const el = chartRef.current
		if (!el) return
		const timer = setTimeout(() => {
			if (el) {
				el.scrollLeft = el.scrollWidth - el.clientWidth
				updateScrollState()
			}
		}, 50)
		return () => clearTimeout(timer)
	}, [period, weeks.length, chartWidth, updateScrollState])

	// Window mousemove / mouseup for smooth right-click and left-click drag scrolling
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isMouseDownRef.current) return
			const container = chartRef.current
			if (!container) return

			const dx = e.clientX - startXRef.current
			if (Math.abs(dx) > 3) {
				hasDraggedRef.current = true
				setIsDragging(true)
				document.body.style.userSelect = 'none'
			}
			container.scrollLeft = startScrollLeftRef.current - dx
			updateScrollState()
			showScrollbarTemporarily()
		}

		const handleMouseUp = () => {
			if (isMouseDownRef.current) {
				isMouseDownRef.current = false
				mouseButtonRef.current = null
				setIsDragging(false)
				document.body.style.userSelect = ''
			}
		}

		window.addEventListener('mousemove', handleMouseMove)
		window.addEventListener('mouseup', handleMouseUp)
		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
			document.body.style.userSelect = ''
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current)
			}
		}
	}, [updateScrollState, showScrollbarTemporarily])

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		// Support left-click (0) and right-click (2)
		if (e.button !== 0 && e.button !== 2) return
		const container = chartRef.current
		if (!container) return

		isMouseDownRef.current = true
		mouseButtonRef.current = e.button
		startXRef.current = e.clientX
		startScrollLeftRef.current = container.scrollLeft
		hasDraggedRef.current = false
	}

	const handleContextMenu = (e: React.MouseEvent) => {
		// Prevent context menu when right-clicking on chart so dragging is smooth
		e.preventDefault()
	}

	const sizingWeekCount = ninetyDayWeekCount
	const cellSize = Math.min(
		36,
		Math.max(
			12,
			Math.floor(
				(chartWidth - 34 - Math.max(0, sizingWeekCount - 1) * 2) /
					Math.max(1, sizingWeekCount)
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

	// Calculate custom scrollbar dimensions
	const canScroll = scrollState.scrollWidth > scrollState.clientWidth + 4
	const thumbWidth = canScroll
		? Math.max(32, (scrollState.clientWidth / scrollState.scrollWidth) * scrollState.clientWidth)
		: 0
	const maxScroll = Math.max(1, scrollState.scrollWidth - scrollState.clientWidth)
	const scrollRatio = Math.min(1, Math.max(0, scrollState.scrollLeft / maxScroll))
	const maxThumbTranslate = Math.max(0, scrollState.clientWidth - thumbWidth)
	const thumbLeft = scrollRatio * maxThumbTranslate

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
				onScroll={handleScroll}
				onMouseDown={handleMouseDown}
				onContextMenu={handleContextMenu}
				className={`mt-5 w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
					canScroll
						? isDragging
							? 'cursor-grabbing select-none'
							: 'cursor-grab select-none'
						: 'cursor-default'
				}`}
				tabIndex={0}
				aria-label='Сетка активности. Перетаскивайте левой или правой кнопкой мыши для прокрутки'
			>
				{/* Generous right padding (pr-6 sm:pr-8) ensures rightmost cells and outline are never clipped */}
				<div className='w-max pr-6 sm:pr-8 pl-1 py-1'>
					<div className='mb-2 flex gap-2'>
						<span
							className='sticky left-0 z-20 w-[26px] shrink-0 bg-[#141516]'
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
						<div className='sticky left-0 z-20 grid w-[26px] shrink-0 grid-rows-7 gap-0.5 border-r border-white/[0.08] bg-[#141516] pr-1 text-[9px] leading-none text-white/55'>
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
											className={`z-0 block transition-colors ${isInRange ? intensity(count) : 'bg-transparent'} ${isToday ? 'relative z-10 bg-emerald-500/50 outline outline-2 outline-emerald-300 outline-offset-1' : ''}`}
											style={{ width: cellSize, height: cellSize }}
										/>
									)
								})
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Auto-fading sleek scroll indicator: appears only while scrolling/dragging, then gently fades out */}
			{canScroll && (
				<div
					className={`mt-2 h-1 w-full rounded-full bg-white/[0.05] overflow-hidden transition-opacity duration-500 ease-out ${
						isScrollbarVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
					}`}
				>
					<div
						className='h-full bg-white/35 rounded-full'
						style={{
							width: `${thumbWidth}px`,
							transform: `translateX(${thumbLeft}px)`
						}}
					/>
				</div>
			)}

			<div className='mt-2.5 flex items-center justify-end gap-1.5 text-[10px] text-white/40'>
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
