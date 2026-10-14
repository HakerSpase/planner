import { type Dispatch, type SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

interface IKanbanAddCardInput {
	filterDate?: string
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function KanbanAddCardInput({
	setItems,
	filterDate
}: IKanbanAddCardInput) {
	const addCard = () => {
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
		<div className='mt-5'>
			<button
				onClick={addCard}
				className='italic opacity-40 text-sm'
			>
				Добавить задачу...
			</button>
		</div>
	)
}
