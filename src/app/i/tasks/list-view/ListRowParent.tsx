import { Draggable, Droppable } from '@hello-pangea/dnd'
import cn from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useState } from 'react'

import type { ITaskResponse } from '@/types/task.types'

import { addDraftTask } from '../add-draft-task'
import { getTaskFilters } from '../columns.data'
import { filterTasks } from '../filter-tasks'

import { ListAddRowInput } from './ListAddRowInput'
import { ListRow } from './ListRow'
import styles from './ListView.module.scss'

interface IListRowParent {
	value: string
	label: string
	items: ITaskResponse[] | undefined
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function ListRowParent({
	value,
	items,
	label,
	setItems
}: IListRowParent) {
	// Выполненные по умолчанию свёрнуты — они редко нужны и только удлиняют список
	const [isCollapsed, setIsCollapsed] = useState(value === 'completed')
	const columnTasks = filterTasks(items, value) || []
	const filterDate = getTaskFilters()[value]?.format()
	const canAdd = value !== 'completed' && value !== 'overdue'
	const hasDraft = items?.some(item => item.id.startsWith('draft-'))

	// Пустую группу «Просрочено» не показываем вовсе
	if (value === 'overdue' && !columnTasks.length) return null

	return (
		<Droppable droppableId={value}>
			{provided => (
				<div
					ref={provided.innerRef}
					{...provided.droppableProps}
				>
					<button
						type='button'
						onClick={() => setIsCollapsed(current => !current)}
						aria-expanded={!isCollapsed}
						className={cn(styles.colHeading, 'w-full text-left')}
					>
						<div className='flex w-full items-center gap-2'>
							<ChevronRight
								size={14}
								className={cn(
									'shrink-0 text-subtle transition-transform',
									!isCollapsed && 'rotate-90'
								)}
							/>
							<span className={cn(value === 'overdue' && 'text-danger')}>
								{label}
							</span>
							<span className='font-mono text-2xs font-normal text-subtle'>
								{columnTasks.length}
							</span>
						</div>
					</button>

					{!isCollapsed &&
						columnTasks.map((item, index) => (
							<Draggable
								key={item.clientKey || item.id}
								draggableId={item.id}
								index={index}
								isDragDisabled={item.id.startsWith('draft-')}
							>
								{provided => (
									<div
										ref={provided.innerRef}
										{...provided.draggableProps}
										style={provided.draggableProps.style}
									>
										<ListRow
											key={item.clientKey || item.id}
											item={item}
											setItems={setItems}
											dragHandleProps={provided.dragHandleProps}
											onAddNext={
												canAdd ? () => addDraftTask(setItems, filterDate) : undefined
											}
										/>
									</div>
								)}
							</Draggable>
						))}

					{provided.placeholder}

					{!isCollapsed && !columnTasks.length && !canAdd && (
						<p className='px-2.5 py-2 text-xs text-subtle'>Пока пусто</p>
					)}

					{!isCollapsed && canAdd && !hasDraft && (
						<ListAddRowInput
							setItems={setItems}
							filterDate={filterDate}
						/>
					)}
				</div>
			)}
		</Droppable>
	)
}
