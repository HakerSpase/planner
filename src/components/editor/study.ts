import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { markdownFixups, splitMergedCards } from './markdown-fixups'

/*
 * Учебная разметка поверх обычного Markdown:
 *
 *   > [!rule] Теорема Пифагора        — цветная выноска; [!rule]- — свёрнута, [!rule]+ — сворачивается
 *   > a² + b² = c²
 *
 *   Что такое синус? :: Отношение противолежащего катета к гипотенузе   — карточка для повторения
 */

export interface ICalloutType {
	type: string
	label: string
	color: string
}

export const CALLOUT_TYPES: ICalloutType[] = [
	{ type: 'rule', label: 'Правило', color: '139 123 255' },
	{ type: 'definition', label: 'Определение', color: '99 179 237' },
	{ type: 'example', label: 'Пример', color: '56 189 248' },
	{ type: 'remember', label: 'Запомни', color: '245 181 70' },
	{ type: 'mistake', label: 'Типичная ошибка', color: '248 113 113' },
	{ type: 'idea', label: 'Идея', color: '74 222 128' },
	{ type: 'tip', label: 'Совет', color: '45 212 191' },
	{ type: 'question', label: 'Вопрос', color: '244 114 182' },
	{ type: 'warning', label: 'Внимание', color: '251 146 60' },
	{ type: 'note', label: 'Заметка', color: '161 161 170' }
]

const CALLOUT_ALIASES: Record<string, string> = {
	правило: 'rule',
	теорема: 'rule',
	определение: 'definition',
	def: 'definition',
	пример: 'example',
	запомни: 'remember',
	important: 'remember',
	ошибка: 'mistake',
	error: 'mistake',
	идея: 'idea',
	совет: 'tip',
	hint: 'tip',
	вопрос: 'question',
	внимание: 'warning',
	caution: 'warning',
	заметка: 'note',
	info: 'note'
}

export const resolveCallout = (raw: string) =>
	CALLOUT_TYPES.find(item => item.type === (CALLOUT_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase())) ??
	CALLOUT_TYPES[CALLOUT_TYPES.length - 1]

export const CALLOUT_MARKER = /^\[!([a-zA-Zа-яёА-ЯЁ]+)\]([+-]?)[ \t]*/
// Разделитель карточки: «вопрос :: ответ»
export const CARD_SEPARATOR = ' :: '

/* ---------- Решорации ---------- */

interface IStudyState {
	decorations: DecorationSet
	// Выноски, которые пользователь развернул/свернул (по позиции начала)
	toggled: Set<number>
}

function build(doc: PMNode, toggled: Set<number>, editable: boolean) {
	const decorations: Decoration[] = []

	doc.descendants((node, pos, parent) => {
		if (node.type.name === 'codeBlock') return false

		if (node.type.name === 'blockquote') {
			const first = node.firstChild
			const text = first?.type.name === 'paragraph' ? first.textContent : ''
			const match = CALLOUT_MARKER.exec(text)
			if (!match) return true
			const callout = resolveCallout(match[1])
			const collapsible = Boolean(match[2])
			const collapsed = collapsible && (match[2] === '-') !== toggled.has(pos)
			const titleText = text.slice(match[0].length).trim()
			decorations.push(
				Decoration.node(pos, pos + node.nodeSize, {
					class: `callout${collapsible ? ' is-collapsible' : ''}${collapsed ? ' is-collapsed' : ''}`,
					style: `--callout: ${callout.color}`,
					'data-callout': callout.type
				}),
				Decoration.node(pos + 1, pos + 1 + first!.nodeSize, {
					class: `callout-title${titleText ? '' : ' is-empty'}`,
					'data-label': callout.label
				}),
				// Метка [!тип] видна только при правке
				Decoration.inline(pos + 2, pos + 2 + match[0].length, {
					class: editable ? 'callout-marker' : 'math-hidden'
				})
			)
			if (collapsible)
				decorations.push(
					Decoration.widget(
						pos + 2,
						() => {
							const button = document.createElement('span')
							button.className = 'callout-toggle'
							button.setAttribute('role', 'button')
							button.setAttribute('aria-label', collapsed ? 'Развернуть' : 'Свернуть')
							button.dataset.calloutToggle = String(pos)
							return button
						},
						{ side: -1, key: `toggle:${pos}:${collapsed}`, ignoreSelection: true }
					)
				)
			return true
		}

		if (node.type.name === 'paragraph' && parent?.type.name !== 'tableCell' && parent?.type.name !== 'tableHeader') {
			// Карточка: «вопрос :: ответ» в одном абзаце
			let offset = 0
			let separatorAt = -1
			node.forEach(child => {
				if (separatorAt < 0 && child.isText && child.text) {
					const index = child.text.indexOf(CARD_SEPARATOR)
					if (index >= 0) separatorAt = offset + index
				}
				offset += child.nodeSize
			})
			if (separatorAt > 0 && separatorAt + CARD_SEPARATOR.length < node.content.size) {
				const start = pos + 1
				decorations.push(
					Decoration.node(pos, pos + node.nodeSize, { class: 'flashcard' }),
					Decoration.inline(start, start + separatorAt, { class: 'card-question' }),
					Decoration.inline(start + separatorAt, start + separatorAt + CARD_SEPARATOR.length, {
						class: 'card-separator'
					}),
					Decoration.inline(start + separatorAt + CARD_SEPARATOR.length, pos + node.nodeSize - 1, {
						class: 'card-answer'
					})
				)
			}
			return false
		}
		return true
	})

	return DecorationSet.create(doc, decorations)
}

const studyKey = new PluginKey<IStudyState>('study')

/*
 * «> [!rule] Заголовок» и следующая строка «> текст» в Markdown — один абзац.
 * Разрезаем: первая строка — заголовок выноски, остальное — её содержимое.
 */
function markdownCallouts(md: any) {
	if (md.__plannerCallouts) return
	md.__plannerCallouts = true
	md.core.ruler.before('inline', 'planner_callout_title', (state: any) => {
		const tokens = state.tokens
		for (let i = 0; i < tokens.length - 2; i++) {
			if (tokens[i].type !== 'blockquote_open' || tokens[i + 1].type !== 'paragraph_open') continue
			const inline = tokens[i + 2]
			const match = /^(\[![^\]\n]+\][+-]?[^\n]*)\n([\s\S]+)$/.exec(inline.content)
			if (!match || !CALLOUT_MARKER.test(match[1])) continue
			inline.content = match[1]
			const close = new state.Token('paragraph_close', 'p', -1)
			const open = new state.Token('paragraph_open', 'p', 1)
			const rest = new state.Token('inline', '', 0)
			rest.content = match[2]
			rest.children = []
			close.block = open.block = rest.block = true
			tokens.splice(i + 3, 0, close, open, rest)
		}
	})
}

export const StudyMarkup = Extension.create({
	name: 'studyMarkup',

	addStorage() {
		return {
			markdown: {
				parse: {
					setup(markdownit: any) {
						markdownit.use(markdownCallouts)
						markdownit.use(markdownFixups)
					}
				}
			}
		}
	},

	addProseMirrorPlugins() {
		const editor = this.editor
		return [
			new Plugin<IStudyState>({
				key: studyKey,
				state: {
					init: (_, state) => ({
						toggled: new Set(),
						decorations: build(state.doc, new Set(), editor.isEditable)
					}),
					apply(tr, value, _old, state) {
						const toggle = tr.getMeta(studyKey) as number | undefined
						if (!tr.docChanged && toggle === undefined && !tr.getMeta('mathRefresh')) return value
						let toggled = value.toggled
						if (tr.docChanged) toggled = new Set(Array.from(toggled, pos => tr.mapping.map(pos)))
						if (toggle !== undefined) {
							toggled = new Set(toggled)
							if (toggled.has(toggle)) toggled.delete(toggle)
							else toggled.add(toggle)
						}
						return { toggled, decorations: build(state.doc, toggled, editor.isEditable) }
					}
				},
				props: {
					decorations(state) {
						return studyKey.getState(state)?.decorations
					},
					handleDOMEvents: {
						mousedown(view, event) {
							const toggle = (event.target as HTMLElement).closest?.('[data-callout-toggle]') as HTMLElement | null
							if (!toggle) return false
							event.preventDefault()
							view.dispatch(view.state.tr.setMeta(studyKey, Number(toggle.dataset.calloutToggle)))
							return true
						}
					}
				}
			})
		]
	}
})

/* ---------- Карточки из текста листа (для повторения) ---------- */

export interface IFlashcard {
	id: string
	front: string
	back: string
}

// Короткий стабильный хэш вопроса — по нему у карточки хранится прогресс
function hash(text: string) {
	let h = 2166136261
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return (h >>> 0).toString(36)
}

export function extractFlashcards(pageId: string, markdown: string): IFlashcard[] {
	const cards: IFlashcard[] = []
	let inCode = false
	for (const raw of markdown.split('\n')) {
		if (/^\s*```/.test(raw)) inCode = !inCode
		if (inCode) continue
		const stripped = raw.replace(/^\s*(?:>\s*)*(?:[-*+]\s+(?:\[[ x]\]\s+)?|\d+[.)]\s+)?/, '')
		if (stripped.trimStart().startsWith('|')) continue
		// Карточки, слипшиеся в одну строку, разрезаем
		for (const line of splitMergedCards(stripped)) {
			const index = line.indexOf(CARD_SEPARATOR)
			if (index <= 0) continue
			const front = line.slice(0, index).trim()
			const back = line.slice(index + CARD_SEPARATOR.length).trim()
			if (!front || !back) continue
			cards.push({ id: `${pageId}:${hash(front)}`, front, back })
		}
	}
	return cards
}
