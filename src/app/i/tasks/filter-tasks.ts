import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

import type { ITaskResponse } from '@/types/task.types'

import { getTaskFilters } from './columns.data'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

export const filterTasks = (
	tasks: ITaskResponse[] | undefined,
	value: string
) => {
	const filters = getTaskFilters()
	switch (value) {
		case 'today':
			return tasks?.filter(
				item =>
					dayjs(item.createdAt).isSame(filters.today, 'day') &&
					!item.isCompleted
			)

		case 'tomorrow':
			return tasks?.filter(
				item =>
					dayjs(item.createdAt).isSame(filters.tomorrow, 'day') &&
					!item.isCompleted
			)

		case 'on-this-week':
			return tasks?.filter(
				item =>
					!dayjs(item.createdAt).isSame(filters.today, 'day') &&
					!dayjs(item.createdAt).isSame(filters.tomorrow, 'day') &&
					dayjs(item.createdAt).isSameOrBefore(filters['on-this-week']) &&
					!item.isCompleted
			)

		case 'on-next-week':
			return tasks?.filter(
				item =>
					dayjs(item.createdAt).isAfter(filters['on-this-week']) &&
					dayjs(item.createdAt).isSameOrBefore(filters['on-next-week']) &&
					!item.isCompleted
			)

		case 'later':
			return tasks?.filter(
				item =>
					(dayjs(item.createdAt).isAfter(filters['on-next-week']) ||
						!item.createdAt) &&
					!item.isCompleted
			)

		case 'completed':
			return tasks?.filter(item => item.isCompleted)

		default:
			return []
	}
}
