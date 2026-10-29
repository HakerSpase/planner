import type { ISubtask, ITaskResponse } from '@/types/task.types'

const MAX_SUBTASKS = 200
const MAX_TITLE_LENGTH = 500

// Принимаем от клиента только ожидаемые поля и обрезаем лишнее.
// null — значит, прислали что-то, что вообще не похоже на список подзадач.
export function sanitizeSubtasks(value: unknown): ISubtask[] | null {
	if (!Array.isArray(value) || value.length > MAX_SUBTASKS) return null

	const result: ISubtask[] = []
	for (const item of value) {
		if (!item || typeof item !== 'object') return null
		const { id, title, isCompleted } = item as Record<string, unknown>
		if (typeof id !== 'string' || !id || typeof title !== 'string') return null
		result.push({
			id: id.slice(0, 64),
			title: title.slice(0, MAX_TITLE_LENGTH),
			isCompleted: Boolean(isCompleted)
		})
	}
	return result
}

export function formatTask(task: Record<string, any>): ITaskResponse {
	return {
		id: task.id,
		name: task.name,
		note: task.note ?? '',
		subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
		priority: task.priority,
		isCompleted: task.is_completed,
		completedAt: task.completed_at,
		createdAt: task.created_at,
		updatedAt: task.updated_at,
		order: task.order ?? 0
	}
}
