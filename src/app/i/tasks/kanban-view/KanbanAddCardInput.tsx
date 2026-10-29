import { Plus } from 'lucide-react'
import { type Dispatch, type SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

import { addDraftTask } from '../add-draft-task'

interface IKanbanAddCardInput {
	filterDate?: string
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
}

export function KanbanAddCardInput({
	setItems,
	filterDate
}: IKanbanAddCardInput) {
	const addCard = () => addDraftTask(setItems, filterDate)

	return (
		<div>
			<button
				onClick={addCard}
				className='flex h-10 w-full items-center gap-2 border border-dashed border-white/10 px-3 text-sm text-subtle transition-colors hover:border-white/25 hover:text-fg'
			>
				<Plus size={16} />
				Добавить задачу
			</button>
		</div>
	)
}
