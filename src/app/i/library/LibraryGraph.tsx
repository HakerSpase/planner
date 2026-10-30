'use client'

import { useQuery } from '@tanstack/react-query'
import cn from 'clsx'
import { Expand, Maximize2, Minus, Plus, Search, Shrink } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { extractWikiLinks, normalizeTitle } from '@/components/editor/wiki-links'

import { type ILibrarySection, type ILibraryTopic, libraryService } from '@/services/library.service'

/*
 * Граф архива, как в Obsidian: листы, темы и разделы — узлы, ссылки [[…]] и вложенность — рёбра.
 * Несколько раскладок, перетаскивание узлов, масштаб колёсиком и щипком, подсветка соседей.
 */

type TypeLayout = 'web' | 'links' | 'clusters' | 'tree'
type TypeKind = 'section' | 'topic' | 'page'

interface INode {
	id: string
	kind: TypeKind
	title: string
	sectionIndex: number
	topicId?: string
	degree: number
	x: number
	y: number
	vx: number
	vy: number
	fixed?: boolean
	// цель для раскладки «дерево»
	tx?: number
	ty?: number
}

interface IEdge {
	source: INode
	target: INode
	kind: 'link' | 'tree'
}

const LAYOUTS: [TypeLayout, string, string][] = [
	['web', 'Сеть', 'Всё вместе: разделы, темы, листы и ссылки'],
	['links', 'Ссылки', 'Только листы и связи [[…]] между ними'],
	['clusters', 'Кластеры', 'Листы собираются вокруг своих разделов'],
	['tree', 'Дерево', 'Разделы → темы → листы по кругу']
]

const SECTION_COLORS = ['#8b7bff', '#38bdf8', '#f472b6', '#4ade80', '#a3e635', '#fb7185', '#2dd4bf', '#c084fc']

const radiusOf = (node: INode) =>
	node.kind === 'section' ? 15 : node.kind === 'topic' ? 9 : 4 + Math.min(7, Math.sqrt(node.degree) * 1.8)

const rgba = (hex: string, alpha: number) => {
	const value = parseInt(hex.slice(1), 16)
	return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

/** Плашка с подписью раздела или темы — скруглённый прямоугольник цвета раздела */
function pill(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
	const r = height / 2
	ctx.beginPath()
	ctx.moveTo(x + r, y)
	ctx.arcTo(x + width, y, x + width, y + height, r)
	ctx.arcTo(x + width, y + height, x, y + height, r)
	ctx.arcTo(x, y + height, x, y, r)
	ctx.arcTo(x, y, x + width, y, r)
	ctx.closePath()
}

export function LibraryGraph({
	sections,
	topics,
	onOpenPage,
	onOpenTopic
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	onOpenPage: (topicId: string, pageId: string) => void
	onOpenTopic: (topicId: string) => void
}) {
	const { data: pages, isLoading } = useQuery({
		queryKey: ['library', 'graph-index'],
		queryFn: libraryService.getSearchIndex,
		staleTime: 60 * 1000
	})

	const [layout, setLayout] = useState<TypeLayout>('web')
	const [query, setQuery] = useState('')
	const [showLabels, setShowLabels] = useState(true)
	const [showOrphans, setShowOrphans] = useState(true)
	// Во весь экран — граф поверх всего окна
	const [fullscreen, setFullscreen] = useState(false)
	useEffect(() => {
		if (!fullscreen) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setFullscreen(false)
		}
		document.addEventListener('keydown', onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.removeEventListener('keydown', onKey)
			document.body.style.overflow = overflow
		}
	}, [fullscreen])

	/* ---------- Узлы и рёбра ---------- */

	const graph = useMemo(() => {
		const nodes: INode[] = []
		const edges: IEdge[] = []
		const byId = new Map<string, INode>()
		const sectionIndex = new Map(sections.map((section, index) => [section.id, index]))
		const topicSection = new Map(topics.map(topic => [topic.id, topic.section_id]))
		const add = (node: Omit<INode, 'x' | 'y' | 'vx' | 'vy' | 'degree'>) => {
			const angle = Math.random() * Math.PI * 2
			const distance = 60 + Math.random() * 200
			const full: INode = { ...node, degree: 0, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, vx: 0, vy: 0 }
			nodes.push(full)
			byId.set(full.id, full)
			return full
		}
		const withHierarchy = layout !== 'links'

		if (withHierarchy) {
			sections.forEach((section, index) => add({ id: section.id, kind: 'section', title: section.title, sectionIndex: index }))
			topics.forEach(topic =>
				add({ id: topic.id, kind: 'topic', title: topic.title, sectionIndex: sectionIndex.get(topic.section_id) ?? 0 })
			)
			topics.forEach(topic => {
				const source = byId.get(topic.id)
				const target = byId.get(topic.section_id)
				if (source && target) edges.push({ source, target, kind: 'tree' })
			})
		}

		const titleToPage = new Map<string, string>()
		;(pages || []).forEach(page => {
			add({
				id: page.id,
				kind: 'page',
				title: page.title || 'Без названия',
				topicId: page.topic_id,
				sectionIndex: sectionIndex.get(topicSection.get(page.topic_id) || '') ?? 0
			})
			if (page.title.trim()) titleToPage.set(normalizeTitle(page.title), page.id)
			if (withHierarchy) {
				const topic = byId.get(page.topic_id)
				if (topic) edges.push({ source: byId.get(page.id)!, target: topic, kind: 'tree' })
			}
		})

		const seen = new Set<string>()
		;(pages || []).forEach(page => {
			extractWikiLinks(page.content).forEach(title => {
				const targetId = titleToPage.get(normalizeTitle(title))
				if (!targetId || targetId === page.id) return
				const key = [page.id, targetId].sort().join(':')
				if (seen.has(key)) return
				seen.add(key)
				edges.push({ source: byId.get(page.id)!, target: byId.get(targetId)!, kind: 'link' })
			})
		})

		edges.forEach(edge => {
			edge.source.degree++
			edge.target.degree++
		})

		let visible = nodes
		if (!showOrphans) {
			const linked = new Set(edges.filter(edge => edge.kind === 'link').flatMap(edge => [edge.source.id, edge.target.id]))
			visible = nodes.filter(node => node.kind !== 'page' || linked.has(node.id))
		}
		const visibleIds = new Set(visible.map(node => node.id))
		return {
			nodes: visible,
			edges: edges.filter(edge => visibleIds.has(edge.source.id) && visibleIds.has(edge.target.id)),
			linkCount: seen.size
		}
	}, [pages, sections, topics, layout, showOrphans])

	// Соседи — для подсветки при наведении
	const neighbors = useMemo(() => {
		const map = new Map<string, Set<string>>()
		graph.edges.forEach(({ source, target }) => {
			if (!map.has(source.id)) map.set(source.id, new Set())
			if (!map.has(target.id)) map.set(target.id, new Set())
			map.get(source.id)!.add(target.id)
			map.get(target.id)!.add(source.id)
		})
		return map
	}, [graph])

	/* ---------- Раскладка «дерево»: круги разделов, тем и листов ---------- */

	useEffect(() => {
		if (layout !== 'tree') return
		const sectionNodes = graph.nodes.filter(node => node.kind === 'section')
		const leaves: INode[] = []
		sectionNodes.forEach(section => {
			graph.nodes
				.filter(node => node.kind === 'topic' && graph.edges.some(edge => edge.source === node && edge.target === section))
				.forEach(topic => {
					const topicPages = graph.edges.filter(edge => edge.target === topic && edge.source.kind === 'page').map(edge => edge.source)
					leaves.push(...(topicPages.length ? topicPages : [topic]))
				})
		})
		const ringPages = Math.max(220, leaves.length * 9)
		leaves.forEach((leaf, index) => {
			const angle = (index / Math.max(1, leaves.length)) * Math.PI * 2
			const r = leaf.kind === 'page' ? ringPages : ringPages * 0.62
			leaf.tx = Math.cos(angle) * r
			leaf.ty = Math.sin(angle) * r
		})
		// Темы и разделы — в середине «своих» листьев
		const place = (kind: TypeKind, radius: number) =>
			graph.nodes
				.filter(node => node.kind === kind)
				.forEach(node => {
					const children = graph.edges.filter(edge => edge.target === node).map(edge => edge.source)
					const placed = children.filter(child => child.tx !== undefined)
					if (!placed.length) return
					const angle = Math.atan2(
						placed.reduce((sum, child) => sum + child.ty!, 0),
						placed.reduce((sum, child) => sum + child.tx!, 0)
					)
					node.tx = Math.cos(angle) * radius
					node.ty = Math.sin(angle) * radius
				})
		place('topic', ringPages * 0.62)
		place('section', ringPages * 0.28)
		graph.nodes.forEach(node => {
			if (node.tx === undefined) {
				node.tx = 0
				node.ty = 0
			}
		})
	}, [graph, layout])

	/* ---------- Холст, симуляция, взаимодействие ---------- */

	const canvasRef = useRef<HTMLCanvasElement>(null)
	const wrapRef = useRef<HTMLDivElement>(null)
	const camera = useRef({ x: 0, y: 0, scale: 1 })
	const alpha = useRef(1)
	const hover = useRef<INode | null>(null)
	const drag = useRef<{ node: INode | null; moved: boolean; lastX: number; lastY: number } | null>(null)
	const pointers = useRef(new Map<number, { x: number; y: number }>())
	const frame = useRef(0)
	const autoFit = useRef(true)
	const [hovered, setHovered] = useState<INode | null>(null)

	const queryKey = normalizeTitle(query)

	// Перерисовка и шаг симуляции; всё в refs, чтобы не перерисовывать React на каждом кадре
	const stateRef = useRef({ graph, layout, showLabels, queryKey, neighbors })
	stateRef.current = { graph, layout, showLabels, queryKey, neighbors }

	const kick = (value = 0.6) => {
		alpha.current = Math.max(alpha.current, value)
		if (!frame.current) frame.current = requestAnimationFrame(tick)
	}

	function step() {
		const { graph, layout } = stateRef.current
		const nodes = graph.nodes
		const a = alpha.current
		if (layout === 'tree') {
			nodes.forEach(node => {
				if (node.fixed) return
				node.x += ((node.tx ?? 0) - node.x) * 0.12
				node.y += ((node.ty ?? 0) - node.y) * 0.12
			})
			alpha.current *= 0.95
			return
		}
		// Отталкивание всех от всех
		for (let i = 0; i < nodes.length; i++) {
			const p = nodes[i]
			for (let j = i + 1; j < nodes.length; j++) {
				const q = nodes[j]
				let dx = q.x - p.x
				let dy = q.y - p.y
				let d2 = dx * dx + dy * dy
				if (d2 < 1) {
					dx = Math.random() - 0.5
					dy = Math.random() - 0.5
					d2 = 1
				}
				if (d2 > 250000) continue
				const force = (520 * a) / d2
				p.vx -= dx * force
				p.vy -= dy * force
				q.vx += dx * force
				q.vy += dy * force
			}
		}
		// Пружины рёбер
		graph.edges.forEach(({ source, target, kind }) => {
			const dx = target.x - source.x
			const dy = target.y - source.y
			const distance = Math.sqrt(dx * dx + dy * dy) || 1
			const rest = kind === 'link' ? 70 : target.kind === 'section' ? 70 : 42
			const strength = kind === 'link' ? 0.06 : 0.1
			const force = ((distance - rest) / distance) * strength * a
			source.vx += dx * force
			source.vy += dy * force
			target.vx -= dx * force
			target.vy -= dy * force
		})
		// Тяготение: к центру или к центру своего раздела
		const clusterCount = Math.max(1, sections.length)
		nodes.forEach(node => {
			let cx = 0
			let cy = 0
			if (layout === 'clusters') {
				const angle = (node.sectionIndex / clusterCount) * Math.PI * 2
				cx = Math.cos(angle) * 260
				cy = Math.sin(angle) * 260
			}
			const pull = layout === 'clusters' ? 0.03 : 0.012
			node.vx += (cx - node.x) * pull * a
			node.vy += (cy - node.y) * pull * a
		})
		nodes.forEach(node => {
			if (node.fixed) {
				node.vx = node.vy = 0
				return
			}
			node.vx *= 0.6
			node.vy *= 0.6
			node.x += node.vx
			node.y += node.vy
		})
		alpha.current *= 0.985
	}

	function draw() {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!canvas || !ctx) return
		const { graph, showLabels, queryKey, neighbors } = stateRef.current
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const width = canvas.clientWidth
		const height = canvas.clientHeight
		if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
			canvas.width = width * dpr
			canvas.height = height * dpr
		}
		const { x: camX, y: camY, scale } = camera.current
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.clearRect(0, 0, width, height)
		ctx.translate(width / 2 + camX, height / 2 + camY)
		ctx.scale(scale, scale)

		const focus = hover.current
		const near = focus ? neighbors.get(focus.id) : null
		const lit = (node: INode) =>
			(!focus || node === focus || near?.has(node.id)) && (!queryKey || normalizeTitle(node.title).includes(queryKey))

		// Рёбра
		graph.edges.forEach(({ source, target, kind }) => {
			const active = focus && (source === focus || target === focus)
			const dim = (focus && !active) || (queryKey && !(lit(source) || lit(target)))
			ctx.beginPath()
			ctx.moveTo(source.x, source.y)
			if (kind === 'link' && stateRef.current.layout === 'tree') {
				ctx.quadraticCurveTo(0, 0, target.x, target.y)
			} else ctx.lineTo(target.x, target.y)
			ctx.strokeStyle =
				kind === 'link'
					? `rgba(139, 123, 255, ${dim ? 0.12 : active ? 0.95 : 0.55})`
					: `rgba(255, 255, 255, ${dim ? 0.03 : active ? 0.45 : 0.12})`
			ctx.lineWidth = (kind === 'link' ? 1.6 : 1) / Math.sqrt(scale)
			ctx.stroke()
		})

		// Узлы
		graph.nodes.forEach(node => {
			const radius = radiusOf(node)
			const on = lit(node)
			const color = SECTION_COLORS[node.sectionIndex % SECTION_COLORS.length]
			ctx.globalAlpha = on ? 1 : 0.18
			ctx.beginPath()
			ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
			if (node.kind === 'page') {
				ctx.fillStyle = node === focus ? '#ffffff' : color
				ctx.fill()
			} else if (node.kind === 'section') {
				// Раздел: свечение, внешнее кольцо и объёмный шар цвета раздела
				const glow = ctx.createRadialGradient(node.x, node.y, radius * 0.8, node.x, node.y, radius * 3)
				glow.addColorStop(0, rgba(color, 0.32))
				glow.addColorStop(1, rgba(color, 0))
				ctx.fillStyle = glow
				ctx.beginPath()
				ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2)
				ctx.fill()
				ctx.beginPath()
				ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2)
				ctx.lineWidth = 1.5
				ctx.strokeStyle = rgba(color, node === focus ? 0.9 : 0.45)
				ctx.stroke()
				const ball = ctx.createRadialGradient(
					node.x - radius * 0.35,
					node.y - radius * 0.35,
					radius * 0.1,
					node.x,
					node.y,
					radius
				)
				ball.addColorStop(0, node === focus ? '#ffffff' : rgba('#ffffff', 0.85))
				ball.addColorStop(0.35, color)
				ball.addColorStop(1, rgba(color, 0.75))
				ctx.beginPath()
				ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
				ctx.fillStyle = ball
				ctx.fill()
			} else {
				// Тема: тёмный диск, кольцо и точка в центре
				ctx.fillStyle = '#121216'
				ctx.fill()
				ctx.lineWidth = 2.5
				ctx.strokeStyle = node === focus ? '#ffffff' : color
				ctx.stroke()
				ctx.beginPath()
				ctx.arc(node.x, node.y, radius * 0.38, 0, Math.PI * 2)
				ctx.fillStyle = color
				ctx.fill()
			}
			ctx.globalAlpha = 1
		})

		// Подписи: разделы и темы всегда, листы — при приближении или наведении
		ctx.textAlign = 'center'
		ctx.textBaseline = 'top'
		graph.nodes.forEach(node => {
			const on = lit(node)
			const important = node.kind !== 'page' || node === focus || near?.has(node.id) || (queryKey && on)
			if (!on && !important) return
			if (!important && (!showLabels || scale < 0.5)) return
			// Размер подписи — в пикселях экрана, независимо от масштаба
			const zoom = Math.min(scale, 1.4)
			const size = (node.kind === 'section' ? 13 : node.kind === 'topic' ? 12 : 11) / zoom
			ctx.font = `${node.kind === 'page' ? 400 : 600} ${size}px Inter, system-ui, sans-serif`
			const label = node.title.length > 32 ? `${node.title.slice(0, 30)}…` : node.title
			const y = node.y + radiusOf(node) + (node.kind === 'section' ? 9 : 5) / zoom
			if (node.kind !== 'page') {
				// Разделы и темы — подпись на плашке цвета раздела
				const color = SECTION_COLORS[node.sectionIndex % SECTION_COLORS.length]
				const padX = (node.kind === 'section' ? 9 : 7) / zoom
				const height = size + (node.kind === 'section' ? 9 : 7) / zoom
				const width = ctx.measureText(label).width + padX * 2
				ctx.globalAlpha = on ? 1 : 0.3
				pill(ctx, node.x - width / 2, y, width, height)
				ctx.fillStyle = node.kind === 'section' ? rgba(color, 0.9) : 'rgba(18, 18, 22, 0.92)'
				ctx.fill()
				ctx.lineWidth = 1 / zoom
				ctx.strokeStyle = rgba(color, node.kind === 'section' ? 1 : 0.7)
				ctx.stroke()
				ctx.textBaseline = 'middle'
				ctx.fillStyle = node.kind === 'section' ? '#0b0b0f' : '#ececf0'
				ctx.fillText(label, node.x, y + height / 2 + 0.5 / zoom)
				ctx.textBaseline = 'top'
				ctx.globalAlpha = 1
				return
			}
			ctx.lineWidth = 3 / scale
			ctx.strokeStyle = 'rgba(9, 9, 11, 0.9)'
			ctx.strokeText(label, node.x, y)
			ctx.fillStyle = on ? 'rgba(236, 236, 240, 0.85)' : 'rgba(236,236,240,0.25)'
			ctx.fillText(label, node.x, y)
		})
	}

	function tick() {
		frame.current = 0
		if (alpha.current > 0.004 || drag.current) step()
		// Граф почти улёгся — один раз подгоняем вид, чтобы он целиком влез в окно
		if (autoFit.current && alpha.current < 0.12) {
			autoFit.current = false
			fit()
		}
		draw()
		if (alpha.current > 0.004 || drag.current) frame.current = requestAnimationFrame(tick)
	}

	// Новый граф или раскладка — встряхиваем и подгоняем вид
	useEffect(() => {
		camera.current = { x: 0, y: 0, scale: graph.nodes.length > 80 ? 0.6 : 0.9 }
		autoFit.current = true
		// Основную часть раскладки считаем сразу, без анимации — граф открывается уже собранным
		alpha.current = 1
		const warmup = graph.nodes.length < 150 ? 220 : graph.nodes.length < 400 ? 90 : 30
		for (let i = 0; i < warmup; i++) step()
		fit()
		kick(Math.max(alpha.current, 0.15))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [graph, layout])

	useEffect(() => {
		kick(0.01)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [query, showLabels])

	useEffect(() => {
		const observer = new ResizeObserver(() => kick(0.01))
		if (wrapRef.current) observer.observe(wrapRef.current)
		return () => {
			observer.disconnect()
			cancelAnimationFrame(frame.current)
			frame.current = 0
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const toWorld = (clientX: number, clientY: number) => {
		const rect = canvasRef.current!.getBoundingClientRect()
		const { x, y, scale } = camera.current
		return {
			x: (clientX - rect.left - rect.width / 2 - x) / scale,
			y: (clientY - rect.top - rect.height / 2 - y) / scale
		}
	}

	const nodeAt = (clientX: number, clientY: number) => {
		const point = toWorld(clientX, clientY)
		let best: INode | null = null
		let bestDistance = Infinity
		for (const node of graph.nodes) {
			const distance = Math.hypot(node.x - point.x, node.y - point.y)
			const reach = radiusOf(node) + 8 / camera.current.scale
			if (distance < reach && distance < bestDistance) {
				best = node
				bestDistance = distance
			}
		}
		return best
	}

	const zoomAt = (factor: number, clientX?: number, clientY?: number) => {
		const cam = camera.current
		const next = Math.min(4, Math.max(0.15, cam.scale * factor))
		const real = next / cam.scale
		if (clientX !== undefined && clientY !== undefined) {
			const rect = canvasRef.current!.getBoundingClientRect()
			const px = clientX - rect.left - rect.width / 2
			const py = clientY - rect.top - rect.height / 2
			cam.x = px - (px - cam.x) * real
			cam.y = py - (py - cam.y) * real
		} else {
			cam.x *= real
			cam.y *= real
		}
		cam.scale = next
		kick(0.01)
	}

	const fit = () => {
		const nodes = stateRef.current.graph.nodes
		const canvas = canvasRef.current
		if (!nodes.length || !canvas) return
		const xs = nodes.map(node => node.x)
		const ys = nodes.map(node => node.y)
		const w = Math.max(...xs) - Math.min(...xs) + 120
		const h = Math.max(...ys) - Math.min(...ys) + 120
		const scale = Math.min(1.6, Math.max(0.15, Math.min(canvas.clientWidth / w, canvas.clientHeight / h)))
		camera.current = {
			scale,
			x: (-(Math.max(...xs) + Math.min(...xs)) / 2) * scale,
			y: (-(Math.max(...ys) + Math.min(...ys)) / 2) * scale
		}
		kick(0.01)
	}

	// Колёсико: масштаб графа, а не прокрутка страницы (React вешает wheel пассивно)
	const zoomRef = useRef(zoomAt)
	zoomRef.current = zoomAt
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const onWheel = (event: WheelEvent) => {
			event.preventDefault()
			zoomRef.current(event.deltaY > 0 ? 0.88 : 1 / 0.88, event.clientX, event.clientY)
		}
		canvas.addEventListener('wheel', onWheel, { passive: false })
		return () => canvas.removeEventListener('wheel', onWheel)
	}, [])

	const pageCount = graph.nodes.filter(node => node.kind === 'page').length

	return (
		<div
			className={cn(
				'flex flex-col border border-border bg-surface',
				fullscreen && 'fixed inset-0 z-[70] border-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
			)}
		>
			<div className='flex flex-wrap items-center gap-2 border-b border-border p-2'>
				<div
					role='radiogroup'
					aria-label='Раскладка графа'
					className='flex flex-wrap divide-x divide-border border border-border'
				>
					{LAYOUTS.map(([value, label, hint]) => (
						<button
							key={value}
							type='button'
							role='radio'
							aria-checked={layout === value}
							title={hint}
							onClick={() => setLayout(value)}
							className={cn(
								'h-8 px-3 text-sm transition-colors',
								layout === value ? 'bg-white/[0.08] text-fg' : 'text-muted hover:text-fg'
							)}
						>
							{label}
						</button>
					))}
				</div>
				<label className='flex h-8 min-w-[10rem] flex-1 items-center gap-2 border border-border px-2'>
					<Search
						size={13}
						className='shrink-0 text-subtle'
					/>
					<input
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder='Найти на графе'
						className='min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle'
					/>
				</label>
				<Toggle
					on={showLabels}
					onClick={() => setShowLabels(value => !value)}
				>
					Подписи
				</Toggle>
				<Toggle
					on={showOrphans}
					onClick={() => setShowOrphans(value => !value)}
				>
					Без связей
				</Toggle>
			</div>

			<div
				ref={wrapRef}
				className={cn('relative', fullscreen ? 'min-h-0 flex-1' : 'h-[min(70vh,44rem)] min-h-[22rem]')}
			>
				<canvas
					ref={canvasRef}
					className={cn('absolute inset-0 h-full w-full touch-none', hovered ? 'cursor-pointer' : 'cursor-grab')}
					onPointerDown={event => {
						event.currentTarget.setPointerCapture(event.pointerId)
						pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
						if (pointers.current.size > 1) {
							drag.current = null
							return
						}
						const node = nodeAt(event.clientX, event.clientY)
						drag.current = { node, moved: false, lastX: event.clientX, lastY: event.clientY }
						if (node) {
							node.fixed = true
							hover.current = node
							setHovered(node)
						}
						kick(0.3)
					}}
					onPointerMove={event => {
						const previous = pointers.current.get(event.pointerId)
						if (previous && pointers.current.size === 2) {
							const other = Array.from(pointers.current.entries()).find(([id]) => id !== event.pointerId)![1]
							const before = Math.hypot(previous.x - other.x, previous.y - other.y)
							const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
							if (before > 10) zoomAt(after / before, (event.clientX + other.x) / 2, (event.clientY + other.y) / 2)
							pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
							return
						}
						if (previous) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
						const current = drag.current
						if (current) {
							const dx = event.clientX - current.lastX
							const dy = event.clientY - current.lastY
							if (Math.abs(dx) + Math.abs(dy) > 2) current.moved = true
							current.lastX = event.clientX
							current.lastY = event.clientY
							if (current.node) {
								const point = toWorld(event.clientX, event.clientY)
								current.node.x = point.x
								current.node.y = point.y
								kick(0.25)
							} else {
								camera.current.x += dx
								camera.current.y += dy
								kick(0.01)
							}
							return
						}
						if (event.pointerType === 'mouse') {
							const node = nodeAt(event.clientX, event.clientY)
							if (node !== hover.current) {
								hover.current = node
								setHovered(node)
								kick(0.01)
							}
						}
					}}
					onPointerUp={event => {
						pointers.current.delete(event.pointerId)
						const current = drag.current
						drag.current = null
						if (!current) return
						if (current.node) {
							current.node.fixed = false
							if (!current.moved) {
								if (current.node.kind === 'page' && current.node.topicId)
									onOpenPage(current.node.topicId, current.node.id)
								else if (current.node.kind === 'topic') onOpenTopic(current.node.id)
							}
							if (event.pointerType !== 'mouse') {
								hover.current = null
								setHovered(null)
							}
						}
						kick(0.05)
					}}
					onPointerCancel={event => {
						pointers.current.delete(event.pointerId)
						if (drag.current?.node) drag.current.node.fixed = false
						drag.current = null
					}}
					onPointerLeave={() => {
						if (drag.current) return
						hover.current = null
						setHovered(null)
						kick(0.01)
					}}
				/>

				{isLoading && <p className='absolute inset-0 grid place-items-center text-sm text-subtle'>Строим граф…</p>}
				{!isLoading && !graph.nodes.length && (
					<p className='absolute inset-0 grid place-items-center px-6 text-center text-sm text-subtle'>
						Пока пусто. Создайте листы и связывайте их ссылками [[Название листа]].
					</p>
				)}

				<div className='absolute right-2 top-2 flex flex-col border border-border bg-bg/80'>
					<GraphButton
						label='Приблизить'
						onClick={() => zoomAt(1.25)}
					>
						<Plus size={14} />
					</GraphButton>
					<GraphButton
						label='Отдалить'
						onClick={() => zoomAt(0.8)}
					>
						<Minus size={14} />
					</GraphButton>
					<GraphButton
						label='Показать всё'
						onClick={fit}
					>
						<Maximize2 size={13} />
					</GraphButton>
					<GraphButton
						label={fullscreen ? 'Свернуть (Esc)' : 'Во весь экран'}
						onClick={() => {
							setFullscreen(value => !value)
							autoFit.current = true
							requestAnimationFrame(() => requestAnimationFrame(fit))
						}}
					>
						{fullscreen ? <Shrink size={13} /> : <Expand size={13} />}
					</GraphButton>
				</div>

				<div className='pointer-events-none absolute bottom-2 left-2 right-2 flex flex-wrap items-end justify-between gap-2'>
					<div className='flex max-w-full flex-wrap gap-x-3 gap-y-1 bg-bg/70 px-2 py-1 text-[11px] text-muted'>
						<span className='flex items-center gap-1.5'>
							<span
								className='h-2.5 w-2.5 rounded-full bg-muted'
								style={{ boxShadow: '0 0 0 2px rgba(161,161,170,0.35), 0 0 8px rgba(161,161,170,0.6)' }}
							/>
							Раздел
						</span>
						<span className='flex items-center gap-1.5'>
							<span className='grid h-2.5 w-2.5 place-items-center rounded-full border-2 border-muted'>
								<span className='h-0.5 w-0.5 rounded-full bg-muted' />
							</span>
							Тема
						</span>
						<span className='flex items-center gap-1.5 border-r border-border pr-3'>
							<span className='h-2 w-2 rounded-full bg-muted' />
							Лист
						</span>
						{sections.map((section, index) => (
							<span
								key={section.id}
								className='flex items-center gap-1.5'
							>
								<span
									className='h-2 w-2 rounded-full'
									style={{ background: SECTION_COLORS[index % SECTION_COLORS.length] }}
								/>
								{section.title}
							</span>
						))}
					</div>
					<span className='bg-bg/70 px-2 py-1 font-mono text-[11px] text-subtle'>
						{pageCount} листов · {graph.linkCount} ссылок
					</span>
				</div>

				{hovered && (
					<div className='pointer-events-none absolute left-2 top-2 max-w-[60%] border border-border bg-bg/90 px-2.5 py-1.5 text-xs'>
						<p className='font-medium text-fg'>{hovered.title}</p>
						<p className='text-subtle'>
							{hovered.kind === 'page' ? 'Лист' : hovered.kind === 'topic' ? 'Тема' : 'Раздел'} · связей:{' '}
							{neighbors.get(hovered.id)?.size || 0}
							{hovered.kind !== 'section' && ' · нажмите, чтобы открыть'}
						</p>
					</div>
				)}
			</div>

			<p className={cn('border-t border-border px-3 py-2 text-xs leading-5 text-subtle', fullscreen && 'hidden')}>
				Связи появляются из ссылок <span className='font-mono text-muted'>[[Название листа]]</span> в тексте — начните
				печатать <span className='font-mono text-muted'>[[</span> в редакторе, и появится подсказка. Узлы можно
				перетаскивать, колёсико или два пальца — масштаб.
			</p>
		</div>
	)
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type='button'
			aria-pressed={on}
			onClick={onClick}
			className={cn(
				'h-8 border px-3 text-sm transition-colors',
				on ? 'border-primary/60 text-fg' : 'border-border text-subtle hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

function GraphButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			onClick={onClick}
			className='grid h-8 w-8 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
		>
			{children}
		</button>
	)
}
