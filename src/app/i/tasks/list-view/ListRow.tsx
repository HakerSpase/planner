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

import styles from './ListView.module.scss'

interface IListRow {
	item: ITaskResponse
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
	dragHandleProps?: DraggableProvidedDragHandleProps | null
}

export function ListRow({ item, setItems, dragHandleProps }: IListRow) {
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
				styles.row,
				watch('isCompleted') ? styles.completed : '',
				'animation-opacity'
			)}
		>
			<div>
				<div className='flex w-full flex-col gap-2'>
					<span className='inline-flex w-full min-w-0 items-center gap-2'>
						<button
							aria-label='Перетащить задачу'
							type='button'
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
					</span>
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
				</div>
			</div>
			<div>
				<Controller
					control={control}
					name='createdAt'
					render={({ field: { value, onChange } }) => (
						<DatePicker
							onChange={onChange}
							value={value || ''}
						/>
					)}
				/>
			</div>
			<div className='capitalize'>
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
			<div>
				<button
					type='button'
					onClick={() =>
						item.id
							? setIsDeleteConfirmOpen(true)
							: setItems(prev => prev?.slice(0, -1))
					}
					className='opacity-50 transition-opacity hover:opacity-100'
				>
					{isDeletePending ? <Loader size={15} /> : <Trash size={15} />}
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
