'use client'

import { DragDropContext } from '@hello-pangea/dnd'

import { COLUMNS } from '../columns.data'
import { useTaskDnd } from '../hooks/useTaskDnd'
import { useTasks } from '../hooks/useTasks'

import { ListRowParent } from './ListRowParent'
import styles from './ListView.module.scss'

export function ListView() {
	const { items, setItems } = useTasks()
	const { onDragEnd } = useTaskDnd()

	return (
		<DragDropContext onDragEnd={onDragEnd}>
			<div className='w-full min-w-0 pb-4'>
				<div className={styles.table}>
					<div className={styles.header}>
						<div>Название задачи</div>
						<div>Срок выполнения</div>
						<div>Приоритет</div>
						<div></div>
					</div>

					<div className={styles.parentsWrapper}>
						{COLUMNS.map(column => (
							<ListRowParent
								items={items}
								label={column.label}
								value={column.value}
								setItems={setItems}
								key={column.value}
							/>
						))}
					</div>
				</div>
			</div>
		</DragDropContext>
	)
}
