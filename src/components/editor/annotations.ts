import { Mark, mergeAttributes } from '@tiptap/core'

/*
 * Оформление текста поверх Markdown: цвет, выделение фоном, члены предложения,
 * части речи и морфемы. В тексте хранится коротко и читаемо — так же его пишет нейросеть:
 *
 *   {red|важно}  {bg-yellow|выделено}  {#e11d48|свой цвет}
 *   {подл|Кот} {сказ|спит} {обст|на окне}
 *   {сущ|кот} {глаг|спит}
 *   {осн|{прист|при}{корень|ход}{суф|и}}{оконч|ть}
 *
 * Внутри можно всё остальное: **жирный**, $формулы$, другие пометки.
 */

export type TypeAnnotationGroup = 'color' | 'highlight' | 'syntax' | 'pos' | 'morpheme' | 'hidden'

export interface IAnnotation {
	code: string
	group: TypeAnnotationGroup
	label: string
	/** Цвет для текста и фона; для остальных групп не нужен */
	color?: string
}

const color = (code: string, label: string, value: string): IAnnotation => ({
	code,
	group: 'color',
	label,
	color: value
})
const highlight = (code: string, label: string, value: string): IAnnotation => ({
	code: `bg-${code}`,
	group: 'highlight',
	label,
	color: value
})

export const TEXT_COLORS: IAnnotation[] = [
	color('red', 'Красный', '#f87171'),
	color('orange', 'Оранжевый', '#fb923c'),
	color('yellow', 'Жёлтый', '#facc15'),
	color('green', 'Зелёный', '#4ade80'),
	color('teal', 'Бирюзовый', '#2dd4bf'),
	color('blue', 'Синий', '#60a5fa'),
	color('purple', 'Фиолетовый', '#a78bfa'),
	color('pink', 'Розовый', '#f472b6'),
	color('gray', 'Серый', '#a1a1aa')
]

export const HIGHLIGHTS: IAnnotation[] = [
	highlight('red', 'Красный фон', 'rgb(248 113 113 / 0.22)'),
	highlight('orange', 'Оранжевый фон', 'rgb(251 146 60 / 0.22)'),
	highlight('yellow', 'Жёлтый фон', 'rgb(250 204 21 / 0.22)'),
	highlight('green', 'Зелёный фон', 'rgb(74 222 128 / 0.2)'),
	highlight('blue', 'Синий фон', 'rgb(96 165 250 / 0.22)'),
	highlight('purple', 'Фиолетовый фон', 'rgb(167 139 250 / 0.24)'),
	highlight('pink', 'Розовый фон', 'rgb(244 114 182 / 0.22)')
]

export const SYNTAX_ROLES: IAnnotation[] = [
	{ code: 'подл', group: 'syntax', label: 'Подлежащее' },
	{ code: 'сказ', group: 'syntax', label: 'Сказуемое' },
	{ code: 'опр', group: 'syntax', label: 'Определение' },
	{ code: 'доп', group: 'syntax', label: 'Дополнение' },
	{ code: 'обст', group: 'syntax', label: 'Обстоятельство' }
]

export const PARTS_OF_SPEECH: IAnnotation[] = [
	{ code: 'сущ', group: 'pos', label: 'Существительное' },
	{ code: 'прил', group: 'pos', label: 'Прилагательное' },
	{ code: 'глаг', group: 'pos', label: 'Глагол' },
	{ code: 'нар', group: 'pos', label: 'Наречие' },
	{ code: 'мест', group: 'pos', label: 'Местоимение' },
	{ code: 'числ', group: 'pos', label: 'Числительное' },
	{ code: 'прич', group: 'pos', label: 'Причастие' },
	{ code: 'деепр', group: 'pos', label: 'Деепричастие' },
	{ code: 'предл', group: 'pos', label: 'Предлог' },
	{ code: 'союз', group: 'pos', label: 'Союз' },
	{ code: 'част', group: 'pos', label: 'Частица' },
	{ code: 'межд', group: 'pos', label: 'Междометие' }
]

export const MORPHEMES: IAnnotation[] = [
	{ code: 'прист', group: 'morpheme', label: 'Приставка' },
	{ code: 'корень', group: 'morpheme', label: 'Корень' },
	{ code: 'суф', group: 'morpheme', label: 'Суффикс' },
	{ code: 'оконч', group: 'morpheme', label: 'Окончание' },
	{ code: 'постф', group: 'morpheme', label: 'Постфикс' },
	{ code: 'осн', group: 'morpheme', label: 'Основа' }
]

// Самопроверка: текст закрыт, пока не нажмёшь
export const HIDDEN_TEXT: IAnnotation = { code: 'скрыть', group: 'hidden', label: 'Скрыть до нажатия' }

const ALL = [HIDDEN_TEXT, ...TEXT_COLORS, ...HIGHLIGHTS, ...SYNTAX_ROLES, ...PARTS_OF_SPEECH, ...MORPHEMES]
const BY_CODE = new Map(ALL.map(item => [item.code, item]))

// Как нейросети и люди пишут то же самое по-другому
const ALIASES: Record<string, string> = {
	красный: 'red',
	оранжевый: 'orange',
	жёлтый: 'yellow',
	желтый: 'yellow',
	зелёный: 'green',
	зеленый: 'green',
	бирюзовый: 'teal',
	синий: 'blue',
	голубой: 'blue',
	фиолетовый: 'purple',
	розовый: 'pink',
	серый: 'gray',
	// Части речи: полные названия и другие сокращения, которые пишут нейросети
	существительное: 'сущ',
	'сущ.': 'сущ',
	прилагательное: 'прил',
	'прил.': 'прил',
	глагол: 'глаг',
	гл: 'глаг',
	'гл.': 'глаг',
	'глаг.': 'глаг',
	наречие: 'нар',
	нареч: 'нар',
	'нар.': 'нар',
	'нареч.': 'нар',
	местоимение: 'мест',
	'мест.': 'мест',
	числительное: 'числ',
	'числ.': 'числ',
	причастие: 'прич',
	'прич.': 'прич',
	деепричастие: 'деепр',
	'деепр.': 'деепр',
	предлог: 'предл',
	'предл.': 'предл',
	союз: 'союз',
	частица: 'част',
	'част.': 'част',
	междометие: 'межд',
	'межд.': 'межд',
	подлеж: 'подл',
	сказуем: 'сказ',
	определ: 'опр',
	дополн: 'доп',
	обстоят: 'обст',
	подлежащее: 'подл',
	сказуемое: 'сказ',
	определение: 'опр',
	дополнение: 'доп',
	обстоятельство: 'обст',
	пр: 'прист',
	приставка: 'прист',
	кор: 'корень',
	суффикс: 'суф',
	ок: 'оконч',
	окончание: 'оконч',
	постфикс: 'постф',
	основа: 'осн',
	hide: 'скрыть',
	hidden: 'скрыть',
	скрытый: 'скрыть',
	спойлер: 'скрыть',
	spoiler: 'скрыть'
}

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i

/** Разобрать код пометки; неизвестный код — не пометка, а обычный текст в фигурных скобках */
export function resolveAnnotation(raw: string): IAnnotation | null {
	const code = ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()
	if (BY_CODE.has(code)) return BY_CODE.get(code)!
	if (HEX.test(code)) return { code, group: 'color', label: code, color: code }
	if (code.startsWith('bg-') && HEX.test(code.slice(3)))
		return { code, group: 'highlight', label: code, color: `${code.slice(3)}40` }
	return null
}

/* ---------------- Markdown: разбор {код|текст} ---------------- */

const OPENER = /^\{([^\s|{}]{1,24})\|/

// Где закрывается пометка, открытая на позиции start (с учётом вложенных скобок)
function findClose(src: string, from: number) {
	let depth = 0
	for (let i = from; i < src.length; i++) {
		const char = src[i]
		if (char === '\\') {
			i++
			continue
		}
		if (char === '{') depth++
		else if (char === '}') {
			if (depth === 0) return i
			depth--
		}
	}
	return -1
}

function markdownAnnotations(md: any) {
	if (md.__plannerAnnotations) return
	md.__plannerAnnotations = true

	// Сразу после правила формул (если оно есть): скобки внутри $…$ — это LaTeX, не пометки
	const ruler = md.inline.ruler
	const add = (name: string, rule: unknown) =>
		ruler.__find__('planner_math_inline') >= 0
			? ruler.after('planner_math_inline', name, rule)
			: ruler.before('escape', name, rule)

	add('planner_annot_open', (state: any, silent: boolean) => {
		if (state.src.charCodeAt(state.pos) !== 0x7b) return false
		const match = OPENER.exec(state.src.slice(state.pos, state.pos + 32))
		if (!match) return false
		const annotation = resolveAnnotation(match[1])
		if (!annotation) return false
		const contentStart = state.pos + match[0].length
		if (findClose(state.src, contentStart) <= contentStart) return false
		if (!silent) {
			const token = state.push('planner_annot_open', 'span', 1)
			token.meta = { code: annotation.code }
			state.env.plannerAnnotDepth = (state.env.plannerAnnotDepth || 0) + 1
		}
		state.pos = contentStart
		return true
	})

	ruler.after('planner_annot_open', 'planner_annot_close', (state: any, silent: boolean) => {
		if (state.src.charCodeAt(state.pos) !== 0x7d || !state.env.plannerAnnotDepth) return false
		if (!silent) {
			state.push('planner_annot_close', 'span', -1)
			state.env.plannerAnnotDepth--
		}
		state.pos++
		return true
	})

	// Пометка не закрылась внутри абзаца — не тащим счётчик в следующий
	md.core.ruler.push('planner_annot_reset', (state: any) => {
		state.env.plannerAnnotDepth = 0
	})

	md.renderer.rules.planner_annot_open = (tokens: any[], index: number) =>
		`<span data-annot="${md.utils.escapeHtml(tokens[index].meta.code)}">`
	md.renderer.rules.planner_annot_close = () => '</span>'
}

/* ---------------- Метки редактора ---------------- */

const createAnnotationMark = (name: string, groups: TypeAnnotationGroup[], options: { inclusive: boolean; withParser?: boolean }) =>
	Mark.create({
		name,
		inclusive: options.inclusive,
		// Морфемы и роли могут лежать друг в друге (основа поверх корня и суффикса)
		excludes: name === 'textColor' || name === 'textHighlight' ? name : '',

		addAttributes() {
			return { code: { default: null } }
		},

		parseHTML() {
			return [
				{
					tag: 'span[data-annot]',
					getAttrs: element => {
						const annotation = resolveAnnotation((element as HTMLElement).dataset.annot || '')
						return annotation && groups.includes(annotation.group) ? { code: annotation.code } : false
					}
				}
			]
		},

		renderHTML({ HTMLAttributes }) {
			const annotation = resolveAnnotation(HTMLAttributes.code || '')
			if (!annotation) return ['span', 0]
			const style =
				annotation.group === 'color'
					? `color: ${annotation.color}`
					: annotation.group === 'highlight'
						? `background-color: ${annotation.color}`
						: undefined
			return [
				'span',
				mergeAttributes({
					'data-annot': annotation.code,
					class: `annot annot-${annotation.group}`,
					...(annotation.group === 'pos' && { 'data-label': annotation.code }),
					...(style && { style })
				}),
				0
			]
		},

		addStorage() {
			return {
				markdown: {
					serialize: {
						open: (_state: unknown, mark: { attrs: { code: string } }) => `{${mark.attrs.code}|`,
						close: '}',
						expelEnclosingWhitespace: true
					},
					parse: options.withParser
						? {
								setup(markdownit: any) {
									markdownit.use(markdownAnnotations)
								}
							}
						: {}
				}
			}
		}
	})

export const TextColor = createAnnotationMark('textColor', ['color'], { inclusive: true, withParser: true })
export const TextHighlight = createAnnotationMark('textHighlight', ['highlight'], { inclusive: true })
export const SyntaxRole = createAnnotationMark('syntaxRole', ['syntax'], { inclusive: false })
export const PartOfSpeech = createAnnotationMark('partOfSpeech', ['pos'], { inclusive: false })
export const Morpheme = createAnnotationMark('morpheme', ['morpheme'], { inclusive: false })

export const HiddenText = createAnnotationMark('hiddenText', ['hidden'], { inclusive: false })

export const ANNOTATION_MARKS = [TextColor, TextHighlight, SyntaxRole, PartOfSpeech, Morpheme, HiddenText]

export const markNameFor = (group: TypeAnnotationGroup) =>
	({
		color: 'textColor',
		highlight: 'textHighlight',
		syntax: 'syntaxRole',
		pos: 'partOfSpeech',
		morpheme: 'morpheme',
		hidden: 'hiddenText'
	})[group]

/** Убрать пометки из текста — для превью и поиска */
export function stripAnnotations(text: string) {
	let previous = ''
	let result = text
	while (result !== previous) {
		previous = result
		result = result.replace(/\{([^\s|{}]{1,24})\|([^{}]*)\}/g, (match, code, inner) =>
			resolveAnnotation(code) ? inner : match
		)
	}
	return result
}
