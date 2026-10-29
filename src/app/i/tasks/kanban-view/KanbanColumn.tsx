import { Draggable, Droppable } from '@hello-pangea/dnd'
import cn from 'clsx'
import { Plus } from 'lucide-react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

import { addDraftTask } from '../add-draft-task'
import { getTaskFilters } from '../columns.data'
import { filterTasks } from '../filter-tasks'

import { KanbanAddCardInput } from './KanbanAddCardInput'
import { KanbanCard } from './KanbanCard'
import styles from './KanbanView.module.scss'

interface IKanbanColumn {
	value: string
	label: string
	items: ITaskResponse[] | undefined
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

// Цвет линии под заголовком колонки
const COLUMN_ACCENT: Record<string, string> = {
	overdue: 'rgb(var(--danger))',
	today: 'rgb(var(--primary))',
	tomorrow: 'rgb(56 189 248)',
	'on-this-week': 'rgb(var(--warning))',
	'on-next-week': 'rgb(255 255 255 / 0.3)',
	later: 'rgb(255 255 255 / 0.18)',
	completed: 'rgb(var(--success))'
}

export function KanbanColumn({ value, items, label, setItems }: IKanbanColumn) {
	const columnTasks = filterTasks(items, value) || []
	const filterDate = getTaskFilters()[value]?.format()
	const canAdd = value !== 'completed' && value !== 'overdue'

	// Пустую колонку «Просрочено» не показываем
	if (value === 'overdue' && !columnTasks.length) return null

	return (
		<Droppable droppableId={value}>
			{provided => (
				<div
					ref={provided.innerRef}
					{...provided.droppableProps}
				>
					<div
						className={styles.column}
						style={{ '--column-accent': COLUMN_ACCENT[value] } as CSSProperties}
					>
						<div className={styles.columnHeading}>
							<span className={cn(value === 'overdue' && 'text-danger')}>{label}</span>
							<span className='font-mono text-2xs font-normal text-subtle'>
								{columnTasks.length}
							</span>
							{canAdd && (
								<button
									type='button'
									aria-label={`Добавить задачу: ${label}`}
									onClick={() => addDraftTask(setItems, filterDate)}
									className='ml-auto grid h-7 w-7 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
								>
									<Plus size={15} />
								</button>
							)}
						</div>

						{columnTasks.map((item, index) => (
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
										<KanbanCard
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

						{canAdd &&
							!items?.some(item => item.id.startsWith('draft-')) && (
								<KanbanAddCardInput
									setItems={setItems}
									filterDate={filterDate}
								/>
							)}
					</div>
				</div>
			)}
		</Droppable>
	)
}
