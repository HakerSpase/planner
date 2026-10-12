export function isValidTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat('en', { timeZone }).format()
		return true
	} catch {
		return false
	}
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date)
	const value = (type: string) =>
		parts.find(part => part.type === type)?.value || '00'
	return `${value('year')}-${value('month')}-${value('day')}`
}

export function startOfDayInTimeZone(dateKey: string, timeZone: string) {
	const [year, month, day] = dateKey.split('-').map(Number)
	let timestamp = Date.UTC(year, month - 1, day)
	for (let attempt = 0; attempt < 3; attempt++) {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(new Date(timestamp))
		const value = (type: string) =>
			Number(parts.find(part => part.type === type)?.value || 0)
		const localAsUtc = Date.UTC(
			value('year'),
			value('month') - 1,
			value('day'),
			value('hour'),
			value('minute'),
			value('second')
		)
		timestamp -= localAsUtc - timestamp
	}
	return new Date(timestamp).toISOString()
}
