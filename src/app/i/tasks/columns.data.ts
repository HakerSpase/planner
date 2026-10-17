import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/ru'
// подключение локали, если она вам нужна
import isoWeek from 'dayjs/plugin/isoWeek'
// ISO неделя
import weekOfYear from 'dayjs/plugin/weekOfYear'

// плагин для работы с неделями

dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)

export const getTaskFilters = (now = dayjs()): Record<string, Dayjs> => {
	const endOfThisWeek = now.endOf('isoWeek')
	// On Sunday (isoWeekday 7), tomorrow is Monday (which is in next week).
	// To prevent on-next-week default colliding with tomorrow, default to Tuesday:
	const nextWeekDefault =
		now.isoWeekday() === 7
			? now.add(2, 'day').startOf('day')
			: now.add(1, 'week').startOf('isoWeek')

	return {
		today: now.startOf('day'),
		tomorrow: now.add(1, 'day').startOf('day'),
		'on-this-week': endOfThisWeek,
		'on-next-week': nextWeekDefault,
		later: now.add(2, 'week').startOf('isoWeek')
	}
}

export const COLUMNS = [
	{
		label: 'Сегодня',
		value: 'today'
	},
	{
		label: 'Завтра',
		value: 'tomorrow'
	},
	{
		label: 'На этой неделе',
		value: 'on-this-week'
	},
	{
		label: 'На следующей неделе',
		value: 'on-next-week'
	},
	{
		label: 'Позже',
		value: 'later'
	},
	{
		label: 'Выполненные',
		value: 'completed'
	}
]
