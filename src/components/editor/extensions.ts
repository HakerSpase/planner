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
	parseHTML() {
		return [
			...(this.parent?.() || []),
			{
				tag: 'div[data-planner-pending][data-kind="image"]',
				getAttrs: element => ({
					src: (element as HTMLElement).getAttribute('data-planner-pending')
				})
			}
		]
	},

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
					// локальный предпросмотр, пока фото грузится, — не сохраняем
					if (typeof src === 'string' && src.startsWith('blob:')) {
						// файл ещё грузится — оставляем отметку, менеджер загрузок заменит её на картинку
						state.write(`<div data-planner-pending="${escapeAttr(src)}" data-kind="image"></div>`)
						state.closeBlock(node)
						return
					}
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

/**
 * Подменить адрес картинки (локальный предпросмотр → ImageKit) или удалить её (src = null).
 * Удалённую картинку сперва подгружаем в кэш браузера, чтобы не было пустого мигания.
 */
export async function replaceImageSrc(editor: Editor, from: string, to: string | null) {
	if (to && to.includes('?tr=')) {
		await new Promise<void>(resolve => {
			const image = new window.Image()
			image.onload = image.onerror = () => resolve()
			image.src = to
		})
	}
	if (editor.isDestroyed) return
	const { state, view } = editor
	const tr = state.tr
	state.doc.descendants((node, pos) => {
		if (!UPLOAD_NODES.includes(node.type.name) || node.attrs.src !== from) return
		if (to) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to })
		else tr.delete(pos, pos + node.nodeSize)
	})
	if (tr.docChanged) view.dispatch(tr)
}

/* ---------------- Удаление файлов из ImageKit ---------------- */

const UPLOAD_NODES = ['image', 'fileAttachment', 'audioAttachment']

const collectUploads = (doc: import('@tiptap/pm/model').Node) => {
	const urls = new Set<string>()
	doc.descendants(node => {
		if (UPLOAD_NODES.includes(node.type.name) && typeof node.attrs.src === 'string')
			urls.add(node.attrs.src)
	})
	return urls
}

/**
 * Запоминаем файлы, которые пользователь убрал из заметки, и удаляем их из ImageKit,
 * когда редактор закрывается — если к тому моменту их не вернули (Ctrl+Z, вставка).
 * Программная смена текста (другой день в «Мыслях») не считается удалением.
 */
export const UploadTracker = Extension.create<{ onDelete: (urls: string[]) => void }>({
	name: 'uploadTracker',

	addOptions() {
		return { onDelete: () => {} }
	},

	addStorage() {
		return { removed: new Set<string>() }
	},

	addProseMirrorPlugins() {
		const removed: Set<string> = this.storage.removed
		return [
			new Plugin({
				key: new PluginKey('uploadTracker'),
				appendTransaction: (transactions, oldState, newState) => {
					const byUser = transactions.some(
						tr => tr.docChanged && !tr.getMeta('preventUpdate')
					)
					if (!byUser) return null
					const after = collectUploads(newState.doc)
					collectUploads(oldState.doc).forEach(src => {
						if (!after.has(src)) removed.add(src)
					})
					return null
				}
			})
		]
	},

	onDestroy() {
		const remaining = collectUploads(this.editor.state.doc)
		const urls = Array.from(this.storage.removed as Set<string>).filter(
			src => !remaining.has(src) && /^https:\/\/ik\.imagekit\.io\//.test(src)
		)
		if (urls.length) this.options.onDelete(urls)
	}
})

/* ---------------- Перетаскивание долгим нажатием (телефон) ---------------- */

const DRAGGABLE_NODES = ['image', 'fileAttachment', 'audioAttachment']

export const TouchDrag = Extension.create({
	name: 'touchDrag',

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('touchDrag'),
				view(view) {
					let timer: ReturnType<typeof setTimeout> | undefined
					let dragging = false
					let fromPos = -1
					let target = -1
					let startX = 0
					let startY = 0
					let indicator: HTMLDivElement | null = null

					const topLevelStart = (index: number) => {
						let pos = 0
						for (let i = 0; i < index; i++) pos += view.state.doc.child(i).nodeSize
						return pos
					}

					const cleanup = () => {
						clearTimeout(timer)
						dragging = false
						fromPos = -1
						target = -1
						indicator?.remove()
						indicator = null
						document.body.style.removeProperty('user-select')
					}

					const onStart = (event: TouchEvent) => {
						if (!view.editable || event.touches.length !== 1) return
						const element = (event.target as HTMLElement).closest('img, [data-drag-block]')
						if (!element) return
						const touch = event.touches[0]
						startX = touch.clientX
						startY = touch.clientY
						timer = setTimeout(() => {
							const found = view.posAtCoords({ left: startX, top: startY })
							if (!found || found.inside < 0) return
							const node = view.state.doc.nodeAt(found.inside)
							if (!node || !DRAGGABLE_NODES.includes(node.type.name)) return
							fromPos = found.inside
							dragging = true
							navigator.vibrate?.(12)
							document.body.style.userSelect = 'none'
							view.dispatch(
								view.state.tr.setSelection(NodeSelection.create(view.state.doc, fromPos))
							)
							indicator = document.createElement('div')
							indicator.style.cssText =
								'position:fixed;height:2px;background:rgb(var(--primary));z-index:200;pointer-events:none;display:none'
							document.body.appendChild(indicator)
						}, 380)
					}

					// Обычное касание: только отменяем долгое нажатие, прокрутку не трогаем
					const onMove = (event: TouchEvent) => {
						if (dragging) return
						const touch = event.touches[0]
						if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 8) clearTimeout(timer)
					}

					const onDragMove = (event: TouchEvent) => {
						const touch = event.touches[0]
						if (!dragging) return
						event.preventDefault()
						const found = view.posAtCoords({ left: touch.clientX, top: touch.clientY })
						if (!found || !indicator) return
						const index = view.state.doc.resolve(found.pos).index(0)
						const blockStart = topLevelStart(index)
						const dom = view.nodeDOM(blockStart) as HTMLElement | null
						if (!dom?.getBoundingClientRect) return
						const rect = dom.getBoundingClientRect()
						const before = touch.clientY < rect.top + rect.height / 2
						target = before
							? blockStart
							: blockStart + view.state.doc.child(index).nodeSize
						indicator.style.display = 'block'
						indicator.style.left = `${rect.left}px`
						indicator.style.width = `${rect.width}px`
						indicator.style.top = `${(before ? rect.top : rect.bottom) - 1}px`
					}

					const onEnd = () => {
						if (dragging && fromPos >= 0 && target >= 0) {
							const node = view.state.doc.nodeAt(fromPos)
							if (node && target !== fromPos && target !== fromPos + node.nodeSize) {
								const tr = view.state.tr.delete(fromPos, fromPos + node.nodeSize)
								const insertAt = target > fromPos ? target - node.nodeSize : target
								tr.insert(insertAt, node)
								tr.setSelection(NodeSelection.create(tr.doc, insertAt))
								view.dispatch(tr.scrollIntoView())
							}
						}
						cleanup()
					}

					// Блокирующий touchmove (чтобы гасить прокрутку при перетаскивании) держим только
					// в режиме правки: с ним браузер ждёт JS на каждом касании и чтение листается рывками
					let blocking = false
					const syncBlocking = () => {
						if (view.editable === blocking) return
						blocking = view.editable
						if (blocking) view.dom.addEventListener('touchmove', onDragMove, { passive: false })
						else view.dom.removeEventListener('touchmove', onDragMove)
					}
					syncBlocking()

					view.dom.addEventListener('touchstart', onStart, { passive: true })
					view.dom.addEventListener('touchmove', onMove, { passive: true })
					view.dom.addEventListener('touchend', onEnd)
					view.dom.addEventListener('touchcancel', cleanup)
					return {
						update: syncBlocking,
						destroy() {
							view.dom.removeEventListener('touchmove', onDragMove)
							cleanup()
							view.dom.removeEventListener('touchstart', onStart)
							view.dom.removeEventListener('touchmove', onMove)
							view.dom.removeEventListener('touchend', onEnd)
							view.dom.removeEventListener('touchcancel', cleanup)
						}
					}
				}
			})
		]
	}
})
