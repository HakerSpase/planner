import type { ITaskResponse, TypeTaskFormState } from '@/types/task.types'

import {
	formatTask,
	sanitizeDueAt,
	sanitizeReminders,
	sanitizeSubtasks
} from '@/app/api/user/tasks/task.mapper'
import { createClient } from '@/lib/supabase/client'

/*
 * Задачи читаются и пишутся напрямую в Supabase из браузера (доступ — по RLS
 * «только свои задачи»). Каждое автосохранение больше не вызывает серверную
 * функцию Vercel. Ответы оставлены в форме { data }, как раньше у axios.
 */

const COLUMNS =
	'id,name,note,subtasks,priority,is_completed,created_at,completed_at,updated_at,order,due_at,reminders'

let client: ReturnType<typeof createClient> | null = null
const db = () => (client ??= createClient())

async function currentUserId() {
	// getSession читает сессию локально, без запроса в сеть
	const { data } = await db().auth.getSession()
	const id = data.session?.user.id
	if (!id) throw new Error('Unauthorized')
	return id
}

function toRow(data: TypeTaskFormState) {
	const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
	if (data.name !== undefined) row.name = data.name
	if (data.note !== undefined) row.note = data.note
	if (data.priority !== undefined) row.priority = data.priority
	if (data.subtasks !== undefined) {
		const subtasks = sanitizeSubtasks(data.subtasks)
		if (!subtasks) throw new Error('Некорректный список подзадач')
		row.subtasks = subtasks
	}
	if (data.isCompleted !== undefined) {
		row.is_completed = data.isCompleted
		row.completed_at = data.isCompleted ? new Date().toISOString() : null
	}
	// пустая дата — задача без срока (NULL), а не невалидная строка
	if (data.createdAt !== undefined) row.created_at = data.createdAt || null
	if (data.order !== undefined) row.order = data.order
	if (data.dueAt !== undefined) row.due_at = sanitizeDueAt(data.dueAt)
	if (data.reminders !== undefined) row.reminders = sanitizeReminders(data.reminders)
	return row
}

const fail = (error: { message: string } | null) => {
	if (error) throw new Error(error.message)
}

class TaskService {
	async getTasks() {
		const { data, error } = await db()
			.from('task')
			.select(COLUMNS)
			.order('order', { ascending: true })
			.order('created_at', { ascending: true })
		fail(error)
		return { data: (data || []).map(formatTask) as ITaskResponse[] }
	}

	async createTask(data: TypeTaskFormState) {
		const userId = await currentUserId()
		const { data: created, error } = await db()
			.from('task')
			.insert({
				name: data.name || '',
				note: data.note || '',
				subtasks: sanitizeSubtasks(data.subtasks ?? []) ?? [],
				priority: data.priority || 'medium',
				is_completed: data.isCompleted || false,
				completed_at: data.isCompleted ? new Date().toISOString() : null,
				created_at: data.createdAt
					? new Date(data.createdAt).toISOString()
					: new Date().toISOString(),
				order: typeof data.order === 'number' ? data.order : 0,
				due_at: sanitizeDueAt(data.dueAt),
				reminders: sanitizeReminders(data.reminders),
				user_id: userId
			})
			.select(COLUMNS)
			.single()
		fail(error)
		return { data: formatTask(created!) }
	}

	async updateTask(id: string, data: TypeTaskFormState) {
		const { data: updated, error } = await db()
			.from('task')
			.update(toRow(data))
			.eq('id', id)
			.select(COLUMNS)
			.single()
		fail(error)
		return { data: formatTask(updated!) }
	}

	async updateOrderTask(ids: string[]) {
		const now = new Date().toISOString()
		const results = await Promise.all(
			ids.map((id, index) =>
				db().from('task').update({ order: index + 1, updated_at: now }).eq('id', id)
			)
		)
		fail(results.find(result => result.error)?.error ?? null)
		return { data: { success: true } }
	}

	async deleteTask(id: string) {
		const { error } = await db().from('task').delete().eq('id', id)
		fail(error)
		return { data: { success: true } }
	}
}

export const taskService = new TaskService()
