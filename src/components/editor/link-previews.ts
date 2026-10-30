import { Extension } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/*
 * Предпросмотр ссылок под абзацем: видео (YouTube, Rutube, VK, Vimeo, Дзен) — плеером,
 * картинки — картинкой, остальное — карточкой с заголовком и описанием страницы.
 * Включён для всех ссылок; отключить у конкретной — правый клик (долгое нажатие) по ссылке.
 * В Markdown это заголовок ссылки: [текст](https://… "nopreview").
 */

export const NO_PREVIEW = 'nopreview'

/** Ссылка с заголовком — чтобы хранить отметку «без предпросмотра» */
export const PlannerLink = Link.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			title: {
				default: null,
				parseHTML: element => element.getAttribute('title'),
				renderHTML: attributes => (attributes.title ? { title: attributes.title === NO_PREVIEW ? null : attributes.title } : {})
			}
		}
	}
})

/* ---------- Что за ссылка ---------- */

export type TypeEmbed =
	| { kind: 'video'; provider: string; src: string; vertical?: boolean }
	| { kind: 'image'; src: string }
	| { kind: 'card' }

const seconds = (value: string | null) => {
	if (!value) return 0
	if (/^\d+$/.test(value)) return Number(value)
	const match = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(value)
	return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0
}

export function detectEmbed(href: string): TypeEmbed {
	let url: URL
	try {
		url = new URL(href)
	} catch {
		return { kind: 'card' }
	}
	const host = url.hostname.replace(/^(www|m)\./, '')
	const path = url.pathname

	// YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
	if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) {
		const id =
			host === 'youtu.be'
				? path.slice(1)
				: url.searchParams.get('v') || /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(path)?.[1]
		if (id) {
			const start = seconds(url.searchParams.get('t') || url.searchParams.get('start'))
			return {
				kind: 'video',
				provider: 'YouTube',
				src: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ''}`,
				vertical: path.startsWith('/shorts/')
			}
		}
	}

	// Rutube: /video/ID/, /shorts/ID/, приватные — с ?p=
	if (host === 'rutube.ru') {
		const id = /^\/(?:video|shorts|play\/embed)\/(?:private\/)?([\da-f]{32})/.exec(path)?.[1]
		if (id) {
			const key = url.searchParams.get('p')
			return {
				kind: 'video',
				provider: 'Rutube',
				src: `https://rutube.ru/play/embed/${id}${key ? `?p=${key}` : ''}`,
				vertical: path.startsWith('/shorts/')
			}
		}
	}

	// VK Видео: vk.com/video-1_2, vkvideo.ru/video-1_2, ?z=video-1_2, клипы
	if (/(^|\.)vk\.com$|^vkvideo\.ru$|^vk\.ru$/.test(host)) {
		const match = /(video|clip)(-?\d+)_(\d+)/.exec(`${path}${url.search}`)
		if (match) {
			return {
				kind: 'video',
				provider: 'VK Видео',
				src: `https://vkvideo.ru/video_ext.php?oid=${match[2]}&id=${match[3]}&hd=2`,
				vertical: match[1] === 'clip'
			}
		}
	}

	if (host === 'vimeo.com' || host === 'player.vimeo.com') {
		const id = /(\d{6,})/.exec(path)?.[1]
		if (id) return { kind: 'video', provider: 'Vimeo', src: `https://player.vimeo.com/video/${id}` }
	}

	if (host === 'dzen.ru') {
		const id = /^\/(?:video\/watch|shorts)\/([\w]+)/.exec(path)?.[1]
		if (id) return { kind: 'video', provider: 'Дзен', src: `https://dzen.ru/embed/${id}` }
	}

	if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path)) return { kind: 'image', src: href }
	return { kind: 'card' }
}

/* ---------- Карточка страницы ---------- */

interface IMeta {
	title?: string
	description?: string
	image?: string
	siteName?: string
}

const metaCache = new Map<string, Promise<IMeta | null>>()

function loadMeta(href: string) {
	if (!metaCache.has(href))
		metaCache.set(
			href,
			fetch(`/api/link-preview?url=${encodeURIComponent(href)}`)
				.then(response => (response.ok ? response.json() : null))
				.catch(() => null)
		)
	return metaCache.get(href)!
}

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text) node.textContent = text
	return node
}

function renderPreview(href: string, label: string) {
	const embed = detectEmbed(href)
	const root = element('div', `link-preview link-preview--${embed.kind}`)
	root.contentEditable = 'false'
	root.dataset.href = href

	if (embed.kind === 'video') {
		const frame = element('div', `link-preview-frame${embed.vertical ? ' is-vertical' : ''}`)
		const iframe = element('iframe')
		iframe.src = embed.src
		iframe.loading = 'lazy'
		iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen'
		iframe.allowFullscreen = true
		iframe.referrerPolicy = 'strict-origin-when-cross-origin'
		iframe.title = label || embed.provider
		frame.appendChild(iframe)
		root.appendChild(frame)
		const caption = element('a', 'link-preview-caption', `${embed.provider} · ${label || href}`)
		;(caption as HTMLAnchorElement).href = href
		;(caption as HTMLAnchorElement).target = '_blank'
		;(caption as HTMLAnchorElement).rel = 'noopener noreferrer'
		root.appendChild(caption)
		return root
	}

	if (embed.kind === 'image') {
		const image = element('img')
		image.src = embed.src
		image.loading = 'lazy'
		image.alt = label
		root.appendChild(image)
		return root
	}

	// Карточка: сразу домен и текст ссылки, заголовок и картинку подгружаем
	const card = element('a', 'link-preview-card') as HTMLAnchorElement
	card.href = href
	card.target = '_blank'
	card.rel = 'noopener noreferrer'
	let host = href
	try {
		host = new URL(href).hostname.replace(/^www\./, '')
	} catch {}
	const text = element('span', 'link-preview-text')
	const site = element('span', 'link-preview-site')
	const icon = element('img', 'link-preview-icon') as HTMLImageElement
	icon.src = `https://${host}/favicon.ico`
	icon.alt = ''
	icon.onerror = () => icon.remove()
	site.append(icon, document.createTextNode(host))
	const title = element('span', 'link-preview-title', label && label !== href ? label : host)
	const description = element('span', 'link-preview-description')
	text.append(site, title, description)
	card.appendChild(text)
	root.appendChild(card)

	loadMeta(href).then(meta => {
		if (!meta) return
		if (meta.title) title.textContent = meta.title
		if (meta.description) description.textContent = meta.description
		if (meta.siteName) site.lastChild!.textContent = meta.siteName
		if (meta.image) {
			const image = element('img', 'link-preview-image') as HTMLImageElement
			image.src = meta.image
			image.loading = 'lazy'
			image.alt = ''
			image.onerror = () => image.remove()
			card.appendChild(image)
		}
	})
	return root
}

/* ---------- Плагин ---------- */

function buildDecorations(doc: PMNode) {
	const decorations: Decoration[] = []
	doc.descendants((node, pos, parent) => {
		if (!node.isTextblock || node.type.name === 'codeBlock') return
		// В таблице предпросмотр ломал бы ячейки — там только ссылки
		if (parent && /^table/.test(parent.type.name)) return false
		const links: { href: string; label: string }[] = []
		node.forEach(child => {
			const link = child.marks.find(mark => mark.type.name === 'link')
			if (!link || link.attrs.title === NO_PREVIEW || !/^https?:/i.test(link.attrs.href)) return
			const last = links[links.length - 1]
			if (last?.href === link.attrs.href) last.label += child.text || ''
			else if (!links.some(item => item.href === link.attrs.href))
				links.push({ href: link.attrs.href, label: child.text || '' })
		})
		links.forEach(({ href, label }, index) =>
			decorations.push(
				Decoration.widget(pos + node.nodeSize, () => renderPreview(href, label.trim()), {
					key: `preview:${href}`,
					side: index + 1,
					ignoreSelection: true,
					stopEvent: () => true
				})
			)
		)
		return false
	})
	return DecorationSet.create(doc, decorations)
}

export interface ILinkMenuRequest {
	href: string
	pos: number
	x: number
	y: number
	hasPreview: boolean
}

export const LinkPreviews = Extension.create<{ onLinkMenu: (request: ILinkMenuRequest, view: EditorView) => void }>({
	name: 'linkPreviews',

	addOptions() {
		return { onLinkMenu: () => {} }
	},

	addProseMirrorPlugins() {
		const options = this.options
		return [
			new Plugin({
				key: new PluginKey('linkPreviews'),
				state: {
					init: (_, state) => buildDecorations(state.doc),
					apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old)
				},
				props: {
					decorations(state) {
						return this.getState(state)
					},
					handleDOMEvents: {
						// Правый клик или долгое нажатие по ссылке — своё меню
						contextmenu(view, event) {
							const anchor = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
							if (!anchor || !view.dom.contains(anchor)) return false
							const pos = view.posAtDOM(anchor, 0)
							const $pos = view.state.doc.resolve(Math.min(pos + 1, view.state.doc.content.size))
							const link = $pos.marks().find(mark => mark.type.name === 'link') ||
								view.state.doc.nodeAt(pos)?.marks.find(mark => mark.type.name === 'link')
							if (!link) return false
							event.preventDefault()
							options.onLinkMenu(
								{
									href: link.attrs.href,
									pos: pos + 1,
									x: event.clientX,
									y: event.clientY,
									hasPreview: link.attrs.title !== NO_PREVIEW
								},
								view
							)
							return true
						}
					}
				}
			})
		]
	}
})
