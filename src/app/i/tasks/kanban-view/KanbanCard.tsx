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

import { TaskDetails } from '../TaskDetails'
import { useDeleteTask } from '../hooks/useDeleteTask'
import { useTaskDebounce } from '../hooks/useTaskDebounce'

import styles from './KanbanView.module.scss'


interface IKanbanCard {
	item: ITaskResponse
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
	dragHandleProps?: DraggableProvidedDragHandleProps | null
	// Enter в названии — создать следующую задачу в той же группе
	onAddNext?: () => void
}

export function KanbanCard({
	item,
	setItems,
	dragHandleProps,
	onAddNext
}: IKanbanCard) {
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
	const { register, control, watch } = useForm<TypeTaskFormState>({
		defaultValues: {
			name: item.name,
			note: item.note ?? '',
			subtasks: item.subtasks ?? [],
			isCompleted: item.isCompleted,
			createdAt: item.createdAt,
			priority: item.priority,
			dueAt: item.dueAt ?? null,
			reminders: item.reminders ?? null
		}
	})

	const { isCreating } = useTaskDebounce({ watch, itemId: item.id, setItems })

	const { deleteTask, isDeletePending } = useDeleteTask()

	return (
		<div
			className={cn(
				styles.card,
				{
					[styles.completed]: watch('isCompleted')
				},
				'animation-opacity group/card'
			)}
		>
			<div className={styles.cardHeader}>
				<button
					type='button'
					aria-label='Перетащить задачу'
					data-task-drag-handle
					{...dragHandleProps}
					className={cn(
						styles.dragHandle,
						'grid h-6 w-4 touch-none cursor-grab place-items-center text-subtle active:cursor-grabbing hover:text-fg'
					)}
				>
					<GripVertical size={13} />
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

				<div className='min-w-0 flex-1'>
					<TransparentField
						{...register('name')}
						autoFocus={item.id.startsWith('draft-')}
						onKeyDown={event => {
							if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
							event.preventDefault()
							event.currentTarget.blur()
							// у черновика ещё нет id на сервере — следующую добавим после сохранения
							if (!item.id.startsWith('draft-')) onAddNext?.()
						}}
						className='px-0 py-0 text-sm font-medium leading-5 sm:text-sm'
					/>
				</div>
			</div>

			<div className='pl-[1.625rem]'>
				<TaskDetails
					control={control}
					taskName={watch('name')}
					taskId={item.id}
					compact
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

					<div className={styles.cardActions}>
						<button
							type='button'
							onClick={() =>
								item.id.startsWith('draft-')
									? setItems(prev => prev?.filter(task => task.id !== item.id))
									: setIsDeleteConfirmOpen(true)
							}
							disabled={isCreating}
							aria-label='Удалить задачу'
							className='grid h-7 w-7 shrink-0 place-items-center text-subtle transition-colors hover:bg-danger/10 hover:text-danger'
						>
							{isCreating || isDeletePending ? (
								<Loader
									size={14}
									className='animate-spin'
								/>
							) : (
								<Trash size={14} />
							)}
						</button>
					</div>
				</div>
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
