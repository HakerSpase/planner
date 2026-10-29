import { Plus } from 'lucide-react'
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
		<div className='mt-1'>
			<button
				onClick={addCard}
				className='flex h-9 w-full items-center gap-2 rounded-lg px-2 text-sm text-subtle transition-colors hover:bg-white/[0.04] hover:text-primary'
			>
				<Plus size={16} />
				Добавить задачу
			</button>
		</div>
	)
}
