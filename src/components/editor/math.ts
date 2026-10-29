import { Extension } from '@tiptap/core'
import Text from '@tiptap/extension-text'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import katex from 'katex'

import { KATEX_MACROS } from './katex-macros'

/*
 * Формулы LaTeX. В тексте хранятся как $…$ (в строке) и $$…$$ (отдельной формулой).
 * При вставке ответов нейросетей понимаем и \(…\), \[…\] — приводим к долларам.
 */

// $$…$$ или $…$ (не путаем «$5 и $10»: после открывающего $ не пробел)
// Для одиночного $ правило как в Pandoc: закрывающий $ не после пробела и не перед цифрой
// \[…\] и \(…\) тоже рисуем — так формулы видны и до сохранения
const MATH_REGEX =
	/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)|\\\(([\s\S]+?)\\\)/g

// Нейросети при копировании «в Markdown» удваивают слеши: \\( \frac … \\, \\)
// Внутри такой формулы снимаем экранирование Markdown: \\, → \,
const unescapeMarkdown = (value: string) => value.replace(/\\([!-\/:-@\[-`{-~])/g, '$1')


// Конец формулы с одиночным $: ищем первый $, подходящий под правило Pandoc
function findInlineDollarEnd(src: string, from: number) {
	for (let end = src.indexOf('$', from); end >= 0; end = src.indexOf('$', end + 1)) {
		if (src[end - 1] === '\n') return -1
		if (!/\s/.test(src[end - 1]) && !/\d/.test(src[end + 1] || '')) return end
	}
	return -1
}

/* ---------------- Markdown: разбор ---------------- */

// markdown-it съедает обратные слеши и подчёркивания внутри формул. Забираем формулу
// целиком раньше остальных правил и кладём в текст как есть.
function markdownMath(md: any) {
	md.inline.ruler.before('escape', 'planner_math_inline', (state: any, silent: boolean) => {
		const src: string = state.src
		const start: number = state.pos
		const pairs: [string, string, boolean][] = [
			['$$', '$$', true],
			['\\\\[', '\\\\]', true],
			['\\\\(', '\\\\)', false],
			['\\[', '\\]', true],
			['\\(', '\\)', false],
			['$', '$', false]
		]
		for (const [open, close, display] of pairs) {
			if (!src.startsWith(open, start)) continue
			if (open === '$' && /\s/.test(src[start + 1] || ' ')) return false
			const end =
				open === '$'
					? findInlineDollarEnd(src, start + 1)
					: src.indexOf(close, start + open.length)
			if (end < 0) continue
			const raw = src.slice(start + open.length, end)
			const body = open.startsWith('\\\\') ? unescapeMarkdown(raw) : raw
			if (!body.trim() || (open === '$' && body.includes('\n'))) continue
			if (!silent) {
				const token = state.push('text', '', 0)
				token.content = display ? `$$${body.trim()}$$` : `$${body.trim()}$`
			}
			state.pos = end + close.length
			return true
		}
		return false
	})

	// Формула на нескольких строках: $$\n…\n$$ или \[\n…\n\]
	md.block.ruler.before(
		'paragraph',
		'planner_math_block',
		(state: any, startLine: number, endLine: number, silent: boolean) => {
			const lineText = (line: number) =>
				state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line])
			const first = lineText(startLine).trim()
			const open = ['$$', '\\\\[', '\\['].find(marker => first.startsWith(marker))
			if (!open) return false
			const close = open === '$$' ? '$$' : open === '\\[' ? '\\]' : '\\\\]'

			let body = first.slice(open.length)
			let line = startLine
			let closed = false
			if (body.trimEnd().endsWith(close) && body.trim().length > close.length - 1) {
				body = body.trimEnd().slice(0, -close.length)
				closed = true
			}
			while (!closed && ++line < endLine) {
				const text = lineText(line)
				if (text.trimEnd().endsWith(close)) {
					body += '\n' + text.trimEnd().slice(0, -close.length)
					closed = true
				} else body += '\n' + text
			}
			if (!closed) return false
			if (silent) return true
			if (open === '\\\\[') body = unescapeMarkdown(body)

			state.line = line + 1
			state.push('paragraph_open', 'p', 1)
			// Содержимое разберёт инлайн-правило выше — оно и сохранит формулу как есть
			const inline = state.push('inline', '', 0)
			inline.content = `$$${body.trim().replace(/\s*\n\s*/g, ' ')}$$`
			inline.map = [startLine, state.line]
			inline.children = []
			state.push('paragraph_close', 'p', -1)
			return true
		}
	)
}

/* ---------------- Markdown: сохранение ---------------- */

// Обычный текст экранируем, формулы пишем как есть — иначе \frac превратится в \\frac
export const MathText = Text.extend({
	addStorage() {
		return {
			markdown: {
				serialize(state: any, node: PMNode) {
					const text = node.text || ''
					let last = 0
					for (const match of Array.from(text.matchAll(MATH_REGEX))) {
						const index = match.index ?? 0
						if (index > last) state.text(escapeHtml(text.slice(last, index)))
						state.text(match[0], false)
						last = index + match[0].length
					}
					if (last < text.length) state.text(escapeHtml(text.slice(last)))
				},
				parse: {
					setup(markdownit: any) {
						markdownit.use(markdownMath)
					}
				}
			}
		}
	}
})

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ---------------- Отрисовка KaTeX ---------------- */

function buildDecorations(doc: PMNode, selection: { from: number; to: number }, editable: boolean) {
	const decorations: Decoration[] = []
	doc.descendants((node, pos, parent) => {
		if (!node.isText || !node.text || parent?.type.name === 'codeBlock') return
		for (const match of Array.from(node.text.matchAll(MATH_REGEX))) {
			const from = pos + (match.index ?? 0)
			const to = from + match[0].length
			const display = match[1] !== undefined || match[2] !== undefined
			const content = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
			const isEditing = editable && selection.from <= to && selection.to >= from
			if (isEditing) {
				decorations.push(Decoration.inline(from, to, { class: 'math-source' }))
				continue
			}
			decorations.push(
				Decoration.inline(from, to, { class: 'math-hidden' }),
				Decoration.widget(
					from,
					() => {
						const element = document.createElement('span')
						element.className = display ? 'math-render math-display' : 'math-render'
						try {
							katex.render(content, element, {
								displayMode: display,
								throwOnError: false,
								strict: 'ignore',
								macros: { ...KATEX_MACROS }
							})
						} catch {
							element.textContent = content
						}
						return element
					},
					{ key: `${display ? 'd' : 'i'}:${content}`, side: -1 }
				)
			)
		}
	})
	return DecorationSet.create(doc, decorations)
}

export const MathRender = Extension.create({
	name: 'mathRender',

	addProseMirrorPlugins() {
		const editor = this.editor
		return [
			new Plugin({
				key: new PluginKey('mathRender'),
				state: {
					init: (_, state) => buildDecorations(state.doc, state.selection, editor.isEditable),
					apply: (tr, old, _oldState, newState) =>
						tr.docChanged || tr.selectionSet || tr.getMeta('mathRefresh')
							? buildDecorations(newState.doc, newState.selection, editor.isEditable)
							: old
				},
				props: {
					decorations(state) {
						return this.getState(state)
					}
				}
			})
		]
	}
})
