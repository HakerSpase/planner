import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { useLocalStorage } from '@/hooks/useLocalStorage'

import { SkeletonRows } from '../Dashboard'

import { TimeBlock } from './TimeBlock'
import styles from './TimeBlocking.module.scss'
import { calcHoursLeft } from './calc-hours-left'
import { useTimeBlockDnd } from './hooks/useTimeBlockDnd'
import { useTimeBlocks } from './hooks/useTimeBlocks'

const DAY = 24 * 60

const toClock = (minutes: number) => {
	const value = ((Math.round(minutes) % DAY) + DAY) % DAY
	return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

const fromClock = (value: string) => {
	const [h, m] = value.split(':').map(Number)
	return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 9 * 60
}

const formatDuration = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return (
		[hours ? `${hours} ч` : '', rest ? `${rest} мин` : ''].filter(Boolean).join(' ') ||
		'0 мин'
	)
}

export function TimeBlockingList() {
	const { items, setItems, isLoading } = useTimeBlocks()
	const { handleDragEnd, sensors } = useTimeBlockDnd(items, setItems)
	const [dayStart, setDayStart] = useLocalStorage<string>({
		key: 'time-blocking-day-start',
		defaultValue: '09:00'
	})

	const startMinutes = fromClock(dayStart)
	const { totalMinutes, remainingMinutes, overbookedMinutes } =
		calcHoursLeft(items)

	// Начало каждого блока = начало дня + длительности всех блоков выше
	let cursor = startMinutes
	const timeline = (items || []).map(item => {
		const start = cursor
		cursor += item.duration
		return { item, start, end: cursor }
	})

	return (
		<div className='min-w-0 border border-border bg-surface'>
			<header className='flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5'>
				<label className='flex items-center gap-3'>
					<span className='eyebrow'>Начало дня</span>
					<input
						type='time'
						value={dayStart}
						onChange={event => setDayStart(event.target.value || '09:00')}
						className='h-8 border border-border bg-surface-2 px-2 font-mono text-sm text-fg outline-none [color-scheme:dark] focus:border-primary/70'
					/>
				</label>
				{timeline.length > 0 && (
					<span className='font-mono text-xs text-muted'>
						{toClock(startMinutes)} – {toClock(cursor)}
					</span>
				)}
			</header>

			{/* Линия суток: где в дне лежат блоки */}
			<div className='border-b border-border px-4 py-4 sm:px-5'>
				<div className='relative h-6 bg-white/[0.03]'>
					{timeline.map(({ item, start, end }) => {
						const left = (start / DAY) * 100
						const width = (Math.min(end, DAY) / DAY) * 100 - left
						if (width <= 0) return null
						return (
							<div
								key={item.id}
								title={`${item.name}: ${toClock(start)} – ${toClock(end)}`}
								className='absolute inset-y-0 border-r border-bg'
								style={{
									left: `${left}%`,
									width: `${width}%`,
									backgroundColor: item.color || '#64748b'
								}}
							/>
						)
					})}
					{cursor > DAY && (
						<div
							className='absolute inset-y-0 right-0 w-1 bg-danger'
							title='План выходит за полночь'
						/>
					)}
				</div>
				<div className='mt-1.5 flex justify-between font-mono text-[10px] text-subtle'>
					{['00', '06', '12', '18', '24'].map(hour => (
						<span key={hour}>{hour}</span>
					))}
				</div>
			</div>

			<div className='p-3 sm:p-4'>
				{isLoading ? (
					<SkeletonRows count={4} />
				) : (
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
					>
						<div className={styles.list}>
							<SortableContext
								items={items || []}
								strategy={verticalListSortingStrategy}
							>
								{timeline.length ? (
									timeline.map(({ item, start, end }) => (
										<TimeBlock
											key={item.id}
											item={item}
											timeRange={`${toClock(start)} – ${toClock(end)}`}
										/>
									))
								) : (
									<div className='border border-dashed border-border-strong py-10 text-center text-sm text-subtle'>
										Добавьте первый блок в форме рядом
									</div>
								)}
							</SortableContext>
						</div>
					</DndContext>
				)}
			</div>

			<dl className='grid grid-cols-2 divide-x divide-border border-t border-border'>
				<div className='px-4 py-3 sm:px-5'>
					<dt className='eyebrow'>Запланировано</dt>
					<dd className='mt-1 text-sm tabular-nums text-fg'>
						{formatDuration(totalMinutes)}
					</dd>
				</div>
				<div className='px-4 py-3 sm:px-5'>
					<dt className='eyebrow'>{overbookedMinutes ? 'Перебор' : 'Свободно'}</dt>
					<dd
						className={
							overbookedMinutes
								? 'mt-1 text-sm tabular-nums text-danger'
								: 'mt-1 text-sm tabular-nums text-fg'
						}
					>
						{formatDuration(overbookedMinutes || remainingMinutes)}
					</dd>
				</div>
			</dl>
		</div>
	)
}
