import { Extension } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/react'

export const IMAGE_WIDTHS = ['33%', '50%', '75%', null] as const
export type TypeImageWidth = (typeof IMAGE_WIDTHS)[number]

const escapeAttr = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Картинка с шириной. В Markdown ширина не выражается, поэтому картинку с шириной
 * сохраняем HTML-тегом <img width>, а без ширины — обычным ![](url).
 */
export const PlannerImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				parseHTML: element => element.getAttribute('width'),
				renderHTML: attributes =>
					attributes.width
						? { width: attributes.width, style: `width: ${attributes.width}` }
						: {}
			}
		}
	},

	addStorage() {
		return {
			markdown: {
				serialize(state: any, node: any) {
					const { src, alt, width } = node.attrs
					if (width) {
						state.write(
							`<img src="${escapeAttr(src)}" alt="${escapeAttr(alt || '')}" width="${escapeAttr(width)}">`
						)
					} else {
						state.write(`![${state.esc(alt || '')}](${src})`)
					}
					state.closeBlock(node)
				},
				parse: {}
			}
		}
	}
})

/** Последним блоком всегда идёт пустой абзац — чтобы можно было писать под картинкой или кодом */
export const TrailingParagraph = Extension.create({
	name: 'trailingParagraph',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('trailingParagraph'),
				appendTransaction: (_transactions, _oldState, state) => {
					const last = state.doc.lastChild
					if (last && last.type.name !== 'paragraph') {
						const paragraph = state.schema.nodes.paragraph.create()
						return state.tr.insert(state.doc.content.size, paragraph)
					}
					return null
				}
			})
		]
	}
})

/** Сдвинуть выделенную картинку на один блок вверх или вниз */
export function moveSelectedNode(editor: Editor, direction: -1 | 1) {
	const { state, view } = editor
	const selection = state.selection
	if (!(selection instanceof NodeSelection)) return

	const $pos = state.doc.resolve(selection.from)
	const parent = $pos.parent
	const index = $pos.index()
	if (direction < 0 && index === 0) return
	if (direction > 0 && index >= parent.childCount - 1) return

	const node = selection.node
	const tr = state.tr.delete(selection.from, selection.to)
	const insertAt =
		direction < 0
			? selection.from - parent.child(index - 1).nodeSize
			: selection.from + parent.child(index + 1).nodeSize
	tr.insert(insertAt, node)
	tr.setSelection(NodeSelection.create(tr.doc, insertAt))
	view.dispatch(tr.scrollIntoView())
}
