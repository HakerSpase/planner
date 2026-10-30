import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { createClient } from '@/lib/supabase/client'

/*
 * Ссылки между листами архива, как в Obsidian: [[Название листа]] или [[Название|подпись]].
 * В тексте хранятся как есть; по ним строится граф связей.
 */

export const WIKI_LINK = /\[\[([^\[\]\n|]{1,200})(?:\|([^\[\]\n]{1,200}))?\]\]/g

export interface IWikiTarget {
	id: string
	title: string
	topic_id: string
}

/* ---------- Список листов для подсказок и переходов (один на всё приложение) ---------- */

let cache: IWikiTarget[] | null = null
let loading: Promise<IWikiTarget[]> | null = null

export function loadWikiTargets(force = false) {
	if (cache && !force) return Promise.resolve(cache)
	if (loading && !force) return loading
	loading = (async () => {
		const { data } = await createClient().from('library_page').select('id,title,topic_id')
		cache = ((data as IWikiTarget[]) || []).filter(page => page.title.trim())
		loading = null
		return cache
	})()
	return loading
}

export const normalizeTitle = (title: string) => title.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')

export function findWikiTarget(targets: IWikiTarget[], title: string) {
	const key = normalizeTitle(title)
	return targets.find(page => normalizeTitle(page.title) === key)
}

/** Открыть лист по названию из ссылки — переход делает оболочка приложения */
export async function openWikiLink(title: string) {
	let target = findWikiTarget(await loadWikiTargets(), title)
	if (!target) target = findWikiTarget(await loadWikiTargets(true), title)
	window.dispatchEvent(
		new CustomEvent('planner:navigate', {
			detail: target
				? { href: `/i/library?topic=${target.topic_id}&page=${target.id}` }
				: { missing: title }
		})
	)
}

/* ---------- Отрисовка и клики ---------- */

function buildDecorations(doc: PMNode, editable: boolean) {
	const decorations: Decoration[] = []
	doc.descendants((node, pos, parent) => {
		if (!node.isText || !node.text || parent?.type.name === 'codeBlock') return
		for (const match of Array.from(node.text.matchAll(WIKI_LINK))) {
			const from = pos + (match.index ?? 0)
			const to = from + match[0].length
			const title = match[1].trim()
			decorations.push(
				Decoration.inline(from, to, {
					class: 'wiki-link',
					'data-wiki': title,
					title: editable ? `${title} — Ctrl+клик, чтобы открыть` : title
				})
			)
			// Скобки и «Название|» при подписи прячем в режиме чтения, при правке — приглушаем
			const hidden = editable ? 'wiki-bracket' : 'math-hidden'
			const labelStart = match[2] !== undefined ? from + 2 + match[1].length + 1 : from + 2
			decorations.push(Decoration.inline(from, labelStart, { class: hidden }))
			decorations.push(Decoration.inline(to - 2, to, { class: hidden }))
		}
	})
	return DecorationSet.create(doc, decorations)
}

export const WikiLinks = Extension.create({
	name: 'wikiLinks',

	addProseMirrorPlugins() {
		const editor = this.editor
		return [
			new Plugin({
				key: new PluginKey('wikiLinks'),
				state: {
					init: (_, state) => buildDecorations(state.doc, editor.isEditable),
					apply: (tr, old, _oldState, newState) =>
						tr.docChanged || tr.getMeta('mathRefresh')
							? buildDecorations(newState.doc, editor.isEditable)
							: old
				},
				props: {
					decorations(state) {
						return this.getState(state)
					},
					handleClick(view, _pos, event) {
						const link = (event.target as HTMLElement).closest?.('[data-wiki]') as HTMLElement | null
						if (!link) return false
						if (view.editable && !event.ctrlKey && !event.metaKey) return false
						event.preventDefault()
						openWikiLink(link.dataset.wiki!)
						return true
					}
				}
			})
		]
	}
})

/** Все ссылки [[…]] из текста листа — для графа */
export function extractWikiLinks(markdown: string) {
	return Array.from(markdown.matchAll(WIKI_LINK), match => match[1].trim())
}
