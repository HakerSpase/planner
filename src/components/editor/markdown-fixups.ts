import { resolveAnnotation } from './annotations'

/*
 * Поправки к Markdown, который присылают нейросети, — до разбора:
 *  1. Пометка, открытая на одной строке и закрытая на другой ({purple|↵$$…$$↵}),
 *     склеивается в одну строку — иначе абзацы её разрывают.
 *  2. Строки-карточки «вопрос :: ответ», идущие подряд без пустой строки,
 *     становятся отдельными абзацами — иначе всё сливается в одну карточку.
 */

const OPENER = /\{([^\s|{}\\]{1,24})\\?\|/g

function joinMultilineAnnotations(src: string) {
	let result = ''
	let last = 0
	const fences: [number, number][] = []
	// Участки ```кода``` не трогаем
	const fencePattern = /^```.*$/gm
	let fenceStart = -1
	for (const match of Array.from(src.matchAll(fencePattern))) {
		if (fenceStart < 0) fenceStart = match.index ?? 0
		else {
			fences.push([fenceStart, (match.index ?? 0) + match[0].length])
			fenceStart = -1
		}
	}
	const inCode = (index: number) => fences.some(([from, to]) => index >= from && index < to)

	for (const match of Array.from(src.matchAll(OPENER))) {
		const start = match.index ?? 0
		if (start < last || inCode(start) || !resolveAnnotation(match[1])) continue
		// Ищем свою закрывающую скобку
		let depth = 0
		let end = -1
		for (let i = start + match[0].length; i < src.length && i < start + 2000; i++) {
			const char = src[i]
			if (char === '\\') {
				i++
				continue
			}
			if (char === '{') depth++
			else if (char === '}') {
				if (depth === 0) {
					end = i
					break
				}
				depth--
			}
		}
		if (end < 0) continue
		const inner = src.slice(start + match[0].length, end)
		if (!inner.includes('\n') || inner.includes('```')) continue
		result += src.slice(last, start) + match[0] + inner.replace(/\s*\n\s*/g, ' ').trim() + '}'
		last = end + 1
	}
	return result + src.slice(last)
}

/**
 * Карточки, слипшиеся в одну строку («В1 :: О1 В2 :: О2 …»), — разрезаем обратно.
 * Граница: следующий вопрос начинается с заглавной буквы — сразу после формулы ответа,
 * а если её нет — с первой заглавной после начала ответа. Формулы не режем.
 */
export function splitMergedCards(line: string): string[] {
	if (line.split(' :: ').length < 3) return [line]
	// Формулы прячем, чтобы заглавные буквы внутри них не считались началом вопроса
	const masked = line.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, match => match.replace(/[^$]/g, '_'))
	const separators: number[] = []
	for (let index = masked.indexOf(' :: '); index >= 0; index = masked.indexOf(' :: ', index + 4))
		separators.push(index)
	const parts: string[] = []
	let start = 0
	for (let i = 0; i < separators.length - 1; i++) {
		const from = separators[i] + 4
		const to = separators[i + 1]
		const region = masked.slice(from, to)
		const candidates = Array.from(region.matchAll(/\s+(?=[А-ЯЁA-Z«])/g)).map(match => ({
			index: from + (match.index ?? 0),
			afterFormula: region[(match.index ?? 0) - 1] === '$',
			length: match[0].length
		}))
		const cut = candidates.find(candidate => candidate.afterFormula) ?? candidates.find(candidate => candidate.index > from)
		if (!cut) continue
		parts.push(line.slice(start, cut.index).trim())
		start = cut.index + cut.length
	}
	parts.push(line.slice(start).trim())
	return parts.filter(Boolean)
}

export function markdownFixups(md: any) {
	if (md.__plannerFixups) return
	md.__plannerFixups = true

	md.core.ruler.before('block', 'planner_fixups_source', (state: any) => {
		state.src = joinMultilineAnnotations(state.src)
	})

	// Абзац из нескольких строк, где есть «::», — каждая строка своим абзацем
	md.core.ruler.before('inline', 'planner_card_lines', (state: any) => {
		const tokens = state.tokens
		for (let i = 0; i < tokens.length - 2; i++) {
			if (tokens[i].type !== 'paragraph_open' || tokens[i + 1].type !== 'inline') continue
			const inline = tokens[i + 1]
			if (!inline.content.includes(' :: ')) continue
			const lines = inline.content
				.split('\n')
				.map((line: string) => line.trim())
				.filter(Boolean)
				.flatMap(splitMergedCards)
			if (lines.length < 2) continue
			const replacement: any[] = []
			lines.forEach((line: string) => {
				const open = new state.Token('paragraph_open', 'p', 1)
				const content = new state.Token('inline', '', 0)
				const close = new state.Token('paragraph_close', 'p', -1)
				content.content = line
				content.children = []
				open.block = content.block = close.block = true
				open.level = tokens[i].level
				replacement.push(open, content, close)
			})
			tokens.splice(i, 3, ...replacement)
			i += replacement.length - 1
		}
	})
}
