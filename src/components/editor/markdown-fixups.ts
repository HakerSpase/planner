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
			if (!inline.content.includes('\n') || !inline.content.includes(' :: ')) continue
			const lines = inline.content.split('\n').map((line: string) => line.trim()).filter(Boolean)
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
