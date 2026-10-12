import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/ru'
// подключение локали, если она вам нужна
import isoWeek from 'dayjs/plugin/isoWeek'
// ISO неделя
import weekOfYear from 'dayjs/plugin/weekOfYear'

// плагин для работы с неделями

dayjs.extend(weekOfYear)
dayjs.extend(isoWeek)

export const getTaskFilters = (now = dayjs()): Record<string, Dayjs> => ({
	today: now.startOf('day'),
	tomorrow: now.add(1, 'day').startOf('day'),
	'on-this-week': now.endOf('isoWeek'),
	'on-next-week': now.add(1, 'week').startOf('day'),
	later: now.add(2, 'week').startOf('day')
})

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
