import { Draggable, Droppable } from '@hello-pangea/dnd'
import type { Dispatch, SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

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

export function KanbanColumn({ value, items, label, setItems }: IKanbanColumn) {
	return (
		<Droppable droppableId={value}>
			{provided => (
				<div
					ref={provided.innerRef}
					{...provided.droppableProps}
				>
					<div className={styles.column}>
						<div className={styles.columnHeading}>{label}</div>

						{filterTasks(items, value)?.map((item, index) => (
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
										/>
									</div>
								)}
							</Draggable>
						))}

						{provided.placeholder}

						{value !== 'completed' &&
							!items?.some(item => item.id.startsWith('draft-')) && (
								<KanbanAddCardInput
									setItems={setItems}
									filterDate={getTaskFilters()[value]?.format()}
								/>
							)}
					</div>
				</div>
			)}
		</Droppable>
	)
}
