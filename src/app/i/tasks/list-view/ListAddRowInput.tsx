import { Plus } from 'lucide-react'
import { type Dispatch, type SetStateAction } from 'react'

import { ITaskResponse } from '@/types/task.types'

import styles from './ListView.module.scss'

interface IListAddRowInput {
	filterDate?: string
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function ListAddRowInput({ setItems, filterDate }: IListAddRowInput) {
	const addRow = () => {
		const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
		setItems(prev => {
			if (!prev) return

			return [
				...prev,
				{
					id: draftId,
					clientKey: draftId,
					name: '',
					isCompleted: false,
					createdAt: filterDate,
					order: (prev.length || 0) + 1
				}
			]
		})
	}

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
