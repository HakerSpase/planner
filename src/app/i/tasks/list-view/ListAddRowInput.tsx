import { Plus } from 'lucide-react'
import { type Dispatch, type SetStateAction } from 'react'

import { ITaskResponse } from '@/types/task.types'

import { addDraftTask } from '../add-draft-task'

import styles from './ListView.module.scss'

interface IListAddRowInput {
	filterDate?: string
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function ListAddRowInput({ setItems, filterDate }: IListAddRowInput) {
	const addRow = () => addDraftTask(setItems, filterDate)

	return (
		<div className={styles.addRow}>
			<button
				onClick={addRow}
				className='flex h-8 items-center gap-2 rounded-md text-sm text-subtle transition-colors hover:text-primary'
			>
				<Plus size={16} />
				Добавить задачу
			</button>
		</div>
	)
}
