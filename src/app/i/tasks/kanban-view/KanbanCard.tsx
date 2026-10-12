import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import cn from 'clsx'
import { GripVertical, Loader, Trash } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Checkbox from '@/components/ui/checkbox'
import { TransparentField } from '@/components/ui/fields/TransparentField'
import { SingleSelect } from '@/components/ui/task-edit/SingleSelect'
import { DatePicker } from '@/components/ui/task-edit/date-picker/DatePicker'

import type { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import { TaskNoteEditor } from '../TaskNoteEditor'
import { useDeleteTask } from '../hooks/useDeleteTask'
import { useTaskDebounce } from '../hooks/useTaskDebounce'

import styles from './KanbanView.module.scss'

interface IKanbanCard {
	item: ITaskResponse
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
	dragHandleProps?: DraggableProvidedDragHandleProps | null
}

export function KanbanCard({ item, setItems, dragHandleProps }: IKanbanCard) {
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
	const { register, control, watch } = useForm<TypeTaskFormState>({
		defaultValues: {
			name: item.name,
			note: item.note ?? '',
			isCompleted: item.isCompleted,
			createdAt: item.createdAt,
			priority: item.priority
		}
	})

	useTaskDebounce({ watch, itemId: item.id })

	const { deleteTask, isDeletePending } = useDeleteTask()

	return (
		<div
			className={cn(
				styles.card,
				{
					[styles.completed]: watch('isCompleted')
				},
				'animation-opacity'
			)}
		>
			<div className={styles.cardHeader}>
				<button
					type='button'
					aria-label='Перетащить задачу'
					{...dragHandleProps}
					className='touch-none cursor-grab active:cursor-grabbing'
				>
					<GripVertical className={styles.grip} />
				</button>

				<Controller
					control={control}
					name='isCompleted'
					render={({ field: { value, onChange } }) => (
						<Checkbox
							onChange={onChange}
							checked={value}
						/>
					)}
				/>

				<TransparentField {...register('name')} />
			</div>

			<Controller
				control={control}
				name='note'
				render={({ field }) => (
					<TaskNoteEditor
						value={field.value || ''}
						onChange={value => field.onChange(value)}
					/>
				)}
			/>

			<div className={styles.cardBody}>
				<Controller
					control={control}
					name='createdAt'
					render={({ field: { value, onChange } }) => (
						<DatePicker
							onChange={onChange}
							value={value || ''}
							position='left'
						/>
					)}
				/>

				<Controller
					control={control}
					name='priority'
					render={({ field: { value, onChange } }) => (
						<SingleSelect
							data={[
								{ value: 'high', label: 'Высокий' },
								{ value: 'medium', label: 'Средний' },
								{ value: 'low', label: 'Низкий' }
							]}
							onChange={onChange}
							value={value || ''}
						/>
					)}
				/>
			</div>

			<div className={styles.cardActions}>
				<button
					type='button'
					onClick={() =>
						item.id
							? setIsDeleteConfirmOpen(true)
							: setItems(prev => prev?.slice(0, -1))
					}
					className='grid h-10 w-10 shrink-0 place-items-center opacity-65 transition-opacity hover:opacity-100'
				>
					{isDeletePending ? <Loader size={17} /> : <Trash size={17} />}
				</button>
			</div>
			{isDeleteConfirmOpen && (
				<ConfirmDialog
					open={isDeleteConfirmOpen}
					title='Удалить задачу?'
					description='Задача и её заметка будут удалены без возможности восстановления.'
					isPending={isDeletePending}
					onConfirm={() => deleteTask(item.id)}
					onClose={() => setIsDeleteConfirmOpen(false)}
				/>
			)}
		</div>
	)
}
