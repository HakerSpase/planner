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
		order: task.order ?? 0,
		dueAt: task.due_at ?? null,
		reminders: Array.isArray(task.reminders) ? task.reminders : null
	}
}

// Напоминания: до 20 штук, от 0 минут до 7 суток до события
export function sanitizeReminders(value: unknown): number[] | null {
	if (value === null || value === undefined) return null
	if (!Array.isArray(value)) return null
	const minutes = value
		.map(Number)
		.filter(item => Number.isInteger(item) && item >= 0 && item <= 7 * 24 * 60)
	return minutes.length ? Array.from(new Set(minutes)).sort((a, b) => b - a).slice(0, 20) : null
}

export function sanitizeDueAt(value: unknown): string | null {
	if (typeof value !== 'string' || !value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
