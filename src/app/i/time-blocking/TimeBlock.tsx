import { Edit, GripVertical, Loader, Trash } from 'lucide-react'
import { type CSSProperties, useState } from 'react'
import { useFormContext } from 'react-hook-form'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import type {
	ITimeBlockResponse,
	TypeTimeBlockFormState
} from '@/types/time-block.types'

import styles from './TimeBlocking.module.scss'
import { useDeleteTimeBlock } from './hooks/useDeleteTimeBlock'
import { useTimeBlockSortable } from './hooks/useTimeBlockSortable'

export function TimeBlock({
	item,
	timeRange
}: {
	item: ITimeBlockResponse
	// «09:00 – 10:30»: считается от начала дня и длительностей блоков выше
	timeRange?: string
}) {
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
	const blockStyle = {
		'--block-color': item.color || '#64748b'
	} as CSSProperties
	const { attributes, listeners, setNodeRef, style } = useTimeBlockSortable(
		item.id
	)
	const { reset } = useFormContext<TypeTimeBlockFormState>()
	const { deleteTimeBlock, isDeletePending } = useDeleteTimeBlock(item.id)

	return (
		<div
			ref={setNodeRef}
			style={style}
		>
			<div
				className={styles.block}
				style={blockStyle}
			>
				<div className='flex min-w-0 flex-1 items-center gap-2'>
					<button
						{...attributes}
						{...listeners}
						type='button'
						aria-describedby='time-block'
						aria-label='Перетащить тайм-блок'
						className='touch-none cursor-grab active:cursor-grabbing'
					>
						<GripVertical className={styles.grip} />
					</button>
					<div className='min-w-0'>
						<div className='break-words font-medium'>{item.name}</div>
						<div className='mt-0.5 flex gap-2 font-mono text-2xs text-subtle'>
							{timeRange && <span className='text-muted'>{timeRange}</span>}
							<span>{item.duration} мин</span>
						</div>
					</div>
				</div>

				<div className='flex shrink-0 items-center gap-1'>
					<button
						type='button'
						onClick={() => {
							reset({
								id: item.id,
								color: item.color,
								duration: item.duration,
								name: item.name,
								order: item.order
							})
						}}
						aria-label='Редактировать блок'
						className='grid h-8 w-8 shrink-0 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<Edit size={16} />
					</button>
					<button
						type='button'
						onClick={() => setIsDeleteConfirmOpen(true)}
						aria-label='Удалить блок'
						className='grid h-8 w-8 shrink-0 place-items-center text-subtle transition-colors hover:bg-danger/10 hover:text-danger'
					>
						{isDeletePending ? <Loader size={16} /> : <Trash size={16} />}
					</button>
				</div>
			</div>
			{isDeleteConfirmOpen && (
				<ConfirmDialog
					open={isDeleteConfirmOpen}
					title='Удалить тайм-блок?'
					description={`Блок «${item.name}» будет удалён из плана дня.`}
					isPending={isDeletePending}
					onConfirm={() => deleteTimeBlock()}
					onClose={() => setIsDeleteConfirmOpen(false)}
				/>
			)}
		</div>
	)
}
