import { DropResult } from '@hello-pangea/dnd'
import type { Dispatch, SetStateAction } from 'react'

import type { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import { taskService } from '@/services/task.service'

import { getTaskFilters } from '../columns.data'
import { filterTasks } from '../filter-tasks'
import { useUpdateTask } from './useUpdateTask'

export function useTaskDnd(
	items?: ITaskResponse[],
	setItems?: Dispatch<SetStateAction<ITaskResponse[] | undefined>>
) {
	const { updateTask } = useUpdateTask()

	const onDragEnd = (result: DropResult) => {
		if (!result.destination) return

		const sourceColId = result.source.droppableId
		const destColId = result.destination.droppableId
		const sourceIndex = result.source.index
		const destIndex = result.destination.index

		// 1. Reordering within the SAME column
		if (sourceColId === destColId) {
			if (sourceIndex === destIndex) return

			const columnTasks = filterTasks(items, sourceColId) || []
			if (!columnTasks.length) return

			const reordered = Array.from(columnTasks)
			const [movedItem] = reordered.splice(sourceIndex, 1)
			if (!movedItem) return
			reordered.splice(destIndex, 0, movedItem)

			const reorderedIds = reordered.map(t => t.id)
			const orderMap = new Map(reorderedIds.map((id, idx) => [id, idx + 1]))

			if (setItems) {
				setItems(current => {
					if (!current) return current
					const updated = current.map(task => {
						const newOrder = orderMap.get(task.id)
						return newOrder !== undefined ? { ...task, order: newOrder } : task
					})
					return [...updated].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
				})
			}

			// Persist reordered IDs to backend
			const validIds = reorderedIds.filter(id => !id.startsWith('draft-'))
			if (validIds.length > 0) {
				taskService.updateOrderTask(validIds).catch(() => {})
			}
			return
		}

		// В «Просрочено» нельзя перенести — у этой группы нет своей даты
		if (destColId === 'overdue') return

		// 2. Moving between DIFFERENT columns
		const targetTasks = (filterTasks(items, destColId) || []).filter(
			t => t.id !== result.draggableId
		)

		let updateData: TypeTaskFormState
		if (destColId === 'completed') {
			updateData = {
				isCompleted: true
			}
		} else {
			const newCreatedAt = getTaskFilters()[destColId]?.format()
			updateData = {
				createdAt: newCreatedAt || null,
				isCompleted: false
			}
		}

		const movedItem = items?.find(t => t.id === result.draggableId)
		if (!movedItem) return

		const updatedMovedItem: ITaskResponse = {
			...movedItem,
			...updateData
		}

		const newTargetTasks = Array.from(targetTasks)
		newTargetTasks.splice(destIndex, 0, updatedMovedItem)

		const targetIds = newTargetTasks.map(t => t.id)
		const targetOrderMap = new Map(targetIds.map((id, idx) => [id, idx + 1]))
		const newOrderForMoved = targetOrderMap.get(movedItem.id) ?? (movedItem.order ?? 0)

		if (setItems) {
			setItems(current => {
				if (!current) return current
				const updated = current.map(task => {
					if (task.id === movedItem.id) {
						return {
							...task,
							...updateData,
							order: newOrderForMoved
						}
					}
					const newOrder = targetOrderMap.get(task.id)
					return newOrder !== undefined ? { ...task, order: newOrder } : task
				})
				return [...updated].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
			})
		}

		// Update the moved task date / completed status
		updateTask({
			id: result.draggableId,
			data: {
				...updateData,
				order: newOrderForMoved
			}
		})

		// Update the order for all items in target column
		const validTargetIds = targetIds.filter(id => !id.startsWith('draft-'))
		if (validTargetIds.length > 0) {
			taskService.updateOrderTask(validTargetIds).catch(() => {})
		}
	}

	return { onDragEnd }
}
