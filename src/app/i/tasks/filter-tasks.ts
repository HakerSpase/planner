import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isoWeek from 'dayjs/plugin/isoWeek'

import type { ITaskResponse } from '@/types/task.types'

import { getTaskFilters } from './columns.data'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isoWeek)

export const filterTasks = (
	tasks: ITaskResponse[] | undefined,
	value: string
) => {
	const now = dayjs()
	const filters = getTaskFilters(now)
	const endOfThisWeek = now.endOf('isoWeek')
	const endOfNextWeek = now.add(1, 'week').endOf('isoWeek')

	switch (value) {
		case 'today':
			return tasks?.filter(item => {
				if (item.isCompleted || !item.createdAt) return false
				const d = dayjs(item.createdAt)
				// If today is Sunday and task was explicitly marked for on-this-week (23:59), keep it in on-this-week
				if (
					now.isoWeekday() === 7 &&
					d.isSame(filters.today, 'day') &&
					d.hour() === 23 &&
					d.minute() === 59
				) {
					return false
				}
				return d.isSame(filters.today, 'day')
			})

		case 'tomorrow':
			return tasks?.filter(item => {
				if (item.isCompleted || !item.createdAt) return false
				const d = dayjs(item.createdAt)
				// If today is Saturday and task was explicitly marked for on-this-week (23:59), keep it in on-this-week
				if (
					now.isoWeekday() === 6 &&
					d.isSame(filters.tomorrow, 'day') &&
					d.hour() === 23 &&
					d.minute() === 59
				) {
					return false
				}
				return d.isSame(filters.tomorrow, 'day')
			})

		case 'on-this-week':
			return tasks?.filter(item => {
				if (item.isCompleted || !item.createdAt) return false
				const d = dayjs(item.createdAt)
				// Explicitly marked as end of this week
				if (
					d.isSame(endOfThisWeek, 'day') &&
					d.hour() === 23 &&
					d.minute() === 59
				) {
					return true
				}
				return (
					!d.isSame(filters.today, 'day') &&
					!d.isSame(filters.tomorrow, 'day') &&
					d.isSameOrBefore(endOfThisWeek)
				)
			})

		case 'on-next-week':
			return tasks?.filter(item => {
				if (item.isCompleted || !item.createdAt) return false
				const d = dayjs(item.createdAt)
				// Exclude tomorrow if tomorrow is in next week (e.g. on Sunday)
				if (d.isSame(filters.tomorrow, 'day')) return false
				return d.isAfter(endOfThisWeek) && d.isSameOrBefore(endOfNextWeek)
			})

		case 'later':
			return tasks?.filter(item => {
				if (item.isCompleted) return false
				if (!item.createdAt) return true
				const d = dayjs(item.createdAt)
				return d.isAfter(endOfNextWeek)
			})

		case 'completed':
			return tasks?.filter(item => item.isCompleted)

		default:
			return []
	}
}
