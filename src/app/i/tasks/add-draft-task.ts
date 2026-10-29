import type { Dispatch, SetStateAction } from 'react'

import type { ITaskResponse } from '@/types/task.types'

// Черновик задачи: создаётся на клиенте, на сервер уходит, когда появится название
export function addDraftTask(
	setItems: Dispatch<SetStateAction<ITaskResponse[] | undefined>>,
	filterDate?: string
) {
	const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
	setItems(prev => {
		if (!prev) return prev
		return [
			...prev,
			{
				id: draftId,
				clientKey: draftId,
				name: '',
				isCompleted: false,
				createdAt: filterDate,
				order: prev.length + 1
			}
		]
	})
}
