import type { IBase } from './root.types'

export enum EnumTaskPriority {
	low = 'low',
	medium = 'medium',
	high = 'high'
}

export interface ISubtask {
	id: string
	title: string
	isCompleted: boolean
}

export interface ITaskResponse extends Omit<IBase, 'createdAt'> {
	createdAt?: string | null
	completedAt?: string | null
	name: string
	note?: string | null
	subtasks?: ISubtask[]
	priority?: EnumTaskPriority
	isCompleted: boolean
	order?: number
	clientKey?: string
}

export type TypeTaskFormState = Partial<
	Omit<ITaskResponse, 'id' | 'updatedAt' | 'clientKey'>
>
