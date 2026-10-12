import { Draggable, Droppable } from '@hello-pangea/dnd'
import type { Dispatch, SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

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
	return (
		<Droppable droppableId={value}>
			{provided => (
				<div
					ref={provided.innerRef}
					{...provided.droppableProps}
				>
					<div className={styles.colHeading}>
						<div className='w-full'>{label}</div>
					</div>

					{filterTasks(items, value)?.map((item, index) => (
						<Draggable
							key={item.id}
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
										key={item.id}
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
							<ListAddRowInput
								setItems={setItems}
								filterDate={getTaskFilters()[value]?.format()}
							/>
						)}
				</div>
			)}
		</Droppable>
	)
}
