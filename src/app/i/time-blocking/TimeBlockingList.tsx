import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

import Loader from '@/components/ui/Loader'

import { TimeBlock } from './TimeBlock'
import styles from './TimeBlocking.module.scss'
import { calcHoursLeft } from './calc-hours-left'
import { useTimeBlockDnd } from './hooks/useTimeBlockDnd'
import { useTimeBlocks } from './hooks/useTimeBlocks'

export function TimeBlockingList() {
	const { items, setItems, isLoading } = useTimeBlocks()
	const { handleDragEnd, sensors } = useTimeBlockDnd(items, setItems)

	if (isLoading) return <Loader />

	const { totalMinutes, remainingMinutes, overbookedMinutes } =
		calcHoursLeft(items)
	const formatDuration = (minutes: number) => {
		const hours = Math.floor(minutes / 60)
		const rest = minutes % 60
		return (
			[hours ? `${hours} ч.` : '', rest ? `${rest} мин.` : '']
				.filter(Boolean)
				.join(' ') || '0 мин.'
		)
	}

	return (
		<div className='card-padded min-w-0'>
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
						{items?.length ? (
							items?.map(item => (
								<TimeBlock
									key={item.id}
									item={item}
								/>
							))
						) : (
							<div className='rounded-lg border border-dashed border-border-strong py-8 text-center text-sm text-subtle'>
								Добавьте первый тайм-блок в форме рядом
							</div>
						)}
					</SortableContext>
				</div>
			</DndContext>
			<div className='mt-4 border-t border-border pt-4'>
				<div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
					<span className='text-muted'>Запланировано за день</span>
					<strong className='font-medium tabular-nums text-fg'>
						{formatDuration(totalMinutes)}
					</strong>
				</div>
				{overbookedMinutes ? (
					<p className='mt-2 text-sm text-warning'>
						План превышает сутки на {formatDuration(overbookedMinutes)}
					</p>
				) : (
					<div className='mt-2 flex flex-wrap items-center justify-between gap-2 text-sm'>
						<span className='text-muted'>Осталось на сон и отдых</span>
						<strong className='font-medium tabular-nums text-fg'>
							{formatDuration(remainingMinutes)}
						</strong>
					</div>
				)}
			</div>
		</div>
	)
}
