import { EnumTaskPriority } from '@/types/task.types'

export interface IQuickTask {
	name: string
	day: Date | null
	time: string | null
	priority: EnumTaskPriority | null
}

const WEEKDAYS: [RegExp, number][] = [
	[/^понедельник[а-яa-z]*$/, 1],
	[/^вторник[а-яa-z]*$/, 2],
	[/^сред[ау]$/, 3],
	[/^четверг[а-яa-z]*$/, 4],
	[/^пятниц[ауы]$/, 5],
	[/^суббот[ауы]$/, 6],
	[/^воскресень[ея]$/, 0]
]

const MONTHS = [
	'январ',
	'феврал',
	'март',
	'апрел',
	'ма',
	'июн',
	'июл',
	'август',
	'сентябр',
	'октябр',
	'ноябр',
	'декабр'
]

const startOfDay = (date: Date) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const pad = (value: number) => String(value).padStart(2, '0')

function monthIndex(word: string) {
	if (/^ма[йя]$/.test(word)) return 4
	if (/^мар/.test(word)) return 2
	return MONTHS.findIndex((prefix, i) => i !== 4 && word.startsWith(prefix))
}

/**
 * Разбор быстрой записи: «реферат завтра в 18:00 !важно» →
 * название «реферат», день — завтра, время 18:00, высокий приоритет.
 * Распознанные слова из названия убираются.
 */
export function parseQuickTask(input: string, now = new Date()): IQuickTask {
	const today = startOfDay(now)
	const words = input.trim().split(/\s+/).filter(Boolean)
	const used = new Set<number>()
	let day: Date | null = null
	let time: string | null = null
	let priority: EnumTaskPriority | null = null

	const lower = words.map(word =>
		word
			.toLowerCase()
			.replace(/ё/g, 'е')
			.replace(/[,.;]+$/, '')
	)
	const take = (...indexes: number[]) =>
		indexes.forEach(index => used.add(index))

	for (let i = 0; i < words.length; i++) {
		if (used.has(i)) continue
		const word = lower[i]
		const next = lower[i + 1] ?? ''

		// Приоритет: !, !!, !!!, !важно, !низкий
		if (
			/^!+$/.test(word) ||
			/^!(важн[а-яa-z]*|высок[а-яa-z]*|срочн[а-яa-z]*)$/.test(word)
		) {
			priority =
				word === '!' || word === '!!'
					? EnumTaskPriority.medium
					: EnumTaskPriority.high
			if (/^![а-яa-z]/.test(word)) priority = EnumTaskPriority.high
			take(i)
			continue
		}
		if (/^!(низк[а-яa-z]*|потом)$/.test(word)) {
			priority = EnumTaskPriority.low
			take(i)
			continue
		}
		if (/^!(средн[а-яa-z]*|обычн[а-яa-z]*)$/.test(word)) {
			priority = EnumTaskPriority.medium
			take(i)
			continue
		}

		// День
		if (!day) {
			if (word === 'сегодня') {
				day = today
				take(i)
				continue
			}
			if (word === 'завтра') {
				day = addDays(today, 1)
				take(i)
				continue
			}
			if (word === 'послезавтра') {
				day = addDays(today, 2)
				take(i)
				continue
			}
			// «через 3 дня», «через неделю»
			if (word === 'через') {
				const amount = Number(next)
				const unit = lower[i + 2] ?? ''
				if (amount > 0 && /^д(ень|ня|ней)$/.test(unit)) {
					day = addDays(today, amount)
					take(i, i + 1, i + 2)
					continue
				}
				if (amount > 0 && /^недел/.test(unit)) {
					day = addDays(today, amount * 7)
					take(i, i + 1, i + 2)
					continue
				}
				if (/^недел[юя]$/.test(next)) {
					day = addDays(today, 7)
					take(i, i + 1)
					continue
				}
			}
			// «в пятницу», «пятница»
			const weekdayWord = (word === 'в' || word === 'во') && next ? next : word
			const weekday = WEEKDAYS.find(([pattern]) => pattern.test(weekdayWord))
			if (weekday) {
				const diff = (weekday[1] - today.getDay() + 7) % 7 || 7
				day = addDays(today, diff)
				take(i)
				if (weekdayWord === next) take(i + 1)
				continue
			}
			// 25.05 или 25.05.2027
			const dotted = word.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/)
			if (dotted) {
				const [, d, m, y] = dotted
				const year = y
					? y.length === 2
						? 2000 + Number(y)
						: Number(y)
					: today.getFullYear()
				let date = new Date(year, Number(m) - 1, Number(d))
				if (!y && date < today)
					date = new Date(year + 1, Number(m) - 1, Number(d))
				if (date.getDate() === Number(d)) {
					day = date
					take(i)
					continue
				}
			}
			// «15 мая»
			if (/^\d{1,2}$/.test(word) && monthIndex(next) >= 0) {
				const month = monthIndex(next)
				let date = new Date(today.getFullYear(), month, Number(word))
				if (date < today)
					date = new Date(today.getFullYear() + 1, month, Number(word))
				day = date
				take(i, i + 1)
				continue
			}
		}

		// Время: 18:00, 9.30 после «в», «в 18», «в 7 вечера»
		if (!time) {
			const clock = word.match(/^(\d{1,2})[:](\d{2})$/)
			if (clock && Number(clock[1]) < 24 && Number(clock[2]) < 60) {
				time = `${pad(Number(clock[1]))}:${clock[2]}`
				take(i)
				if (lower[i - 1] === 'в' && !used.has(i - 1)) take(i - 1)
				continue
			}
			if (word === 'в' && /^\d{1,2}([:.]\d{2})?$/.test(next)) {
				const [h, m = '00'] = next.split(/[:.]/)
				let hours = Number(h)
				const period = lower[i + 2] ?? ''
				if (/^(вечера|дня)$/.test(period) && hours < 12) hours += 12
				if (hours < 24 && Number(m) < 60) {
					time = `${pad(hours)}:${pad(Number(m))}`
					take(i, i + 1)
					if (/^(утра|вечера|дня|ночи)$/.test(period)) take(i + 2)
					continue
				}
			}
		}
	}

	if (time && !day) day = today

	return {
		name: words.filter((_, index) => !used.has(index)).join(' '),
		day,
		time,
		priority
	}
}

/** Подпись дня для подсказки: «сегодня», «завтра», «пт, 7 ноября» */
export function describeDay(day: Date, now = new Date()) {
	const diff = Math.round(
		(startOfDay(day).getTime() - startOfDay(now).getTime()) / 86400000
	)
	if (diff === 0) return 'Сегодня'
	if (diff === 1) return 'Завтра'
	if (diff === 2) return 'Послезавтра'
	return day.toLocaleDateString('ru-RU', {
		weekday: 'short',
		day: 'numeric',
		month: 'long'
	})
}
