import cn from 'clsx'
import { GripVertical, Loader, Trash } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Controller, useForm } from 'react-hook-form'

import Checkbox from '@/components/ui/checkbox'
import { TransparentField } from '@/components/ui/fields/TransparentField'
import { SingleSelect } from '@/components/ui/task-edit/SingleSelect'
import { DatePicker } from '@/components/ui/task-edit/date-picker/DatePicker'

import type { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import { useDeleteTask } from '../hooks/useDeleteTask'
import { useTaskDebounce } from '../hooks/useTaskDebounce'

import styles from './ListView.module.scss'

interface IListRow {
	item: ITaskResponse
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function ListRow({ item, setItems }: IListRow) {
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
					<span className='inline-flex items-center gap-2.5 w-full'>
						<button aria-describedby='todo-item' type='button'>
							<GripVertical className={styles.grip} />
						</button>

						<Controller
							control={control}
							name='isCompleted'
							render={({ field: { value, onChange } }) => (
								<Checkbox onChange={onChange} checked={value} />
							)}
						/>

						<TransparentField {...register('name')} />
					</span>
					<textarea
						{...register('note')}
						aria-label='Заметка к задаче'
						placeholder='Добавить заметку…'
						rows={2}
						className='ml-7 w-[calc(100%-1.75rem)] min-h-12 resize-y rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-sm leading-5 text-white/70 placeholder:text-white/30 focus:border-white/20 focus:outline-none'
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
					onClick={() =>
						item.id
							? window.confirm('Удалить задачу?') && deleteTask(item.id)
							: setItems(prev => prev?.slice(0, -1))
					}
					className='opacity-50 transition-opacity hover:opacity-100'
				>
					{isDeletePending ? <Loader size={15} /> : <Trash size={15} />}
				</button>
			</div>
		</div>
	)
}
