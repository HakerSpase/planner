'use client'

import { DragDropContext } from '@hello-pangea/dnd'
import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState
} from 'react'

import { COLUMNS } from '../columns.data'
import { useTaskDnd } from '../hooks/useTaskDnd'
import { useTasks } from '../hooks/useTasks'

import { KanbanColumn } from './KanbanColumn'
import styles from './KanbanView.module.scss'

export function KanbanView() {
	const { items, setItems } = useTasks()
	const { onDragEnd } = useTaskDnd()
	const [isDraggingTask, setIsDraggingTask] = useState(false)
	const boardRef = useRef<HTMLDivElement>(null)
	const touchPositionRef = useRef<{ x: number; y: number } | null>(null)
	const panRef = useRef<{
		pointerId: number
		x: number
		button: number
		moved: boolean
	} | null>(null)
	const suppressContextMenuUntilRef = useRef(0)

	useEffect(() => {
		if (!isDraggingTask) return
		const trackTouch = (event: TouchEvent) => {
			const touch = event.touches[0] || event.changedTouches[0]
			if (touch)
				touchPositionRef.current = { x: touch.clientX, y: touch.clientY }
		}
		const trackPointer = (event: PointerEvent) => {
			if (event.pointerType === 'touch')
				touchPositionRef.current = { x: event.clientX, y: event.clientY }
		}
		const clearTouch = () => {
			touchPositionRef.current = null
		}
		document.addEventListener('touchmove', trackTouch, {
			capture: true,
			passive: true
		})
		document.addEventListener('touchend', clearTouch, true)
		document.addEventListener('touchcancel', clearTouch, true)
		document.addEventListener('pointermove', trackPointer, true)

		let frame = 0
		const autoScroll = () => {
			const point = touchPositionRef.current
			const board = boardRef.current
			if (point && board) {
				const bounds = board.getBoundingClientRect()
				const pageScroller = board.closest('main')
				const pageBounds = pageScroller?.getBoundingClientRect()
				const edge = 64
				if (board.scrollWidth > board.clientWidth) {
					if (point.x > bounds.right - edge)
						board.scrollLeft += Math.ceil(
							((point.x - (bounds.right - edge)) / edge) * 14
						)
					else if (point.x < bounds.left + edge)
						board.scrollLeft -= Math.ceil(
							((bounds.left + edge - point.x) / edge) * 14
						)
				}
				if (pageScroller && pageBounds) {
					if (point.y > pageBounds.bottom - edge)
						pageScroller.scrollTop += Math.ceil(
							((point.y - (pageBounds.bottom - edge)) / edge) * 14
						)
					else if (point.y < pageBounds.top + edge)
						pageScroller.scrollTop -= Math.ceil(
							((pageBounds.top + edge - point.y) / edge) * 14
						)
				}
			}
			frame = window.requestAnimationFrame(autoScroll)
		}
		frame = window.requestAnimationFrame(autoScroll)
		return () => {
			window.cancelAnimationFrame(frame)
			document.removeEventListener('touchmove', trackTouch, true)
			document.removeEventListener('touchend', clearTouch, true)
			document.removeEventListener('touchcancel', clearTouch, true)
			document.removeEventListener('pointermove', trackPointer, true)
			touchPositionRef.current = null
		}
	}, [isDraggingTask])

	const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === 'touch') {
			touchPositionRef.current = { x: event.clientX, y: event.clientY }
			return
		}
		if (event.button !== 1 && event.button !== 2) return
		if ((event.target as HTMLElement).closest('[data-task-drag-handle]')) return
		event.preventDefault()
		panRef.current = {
			pointerId: event.pointerId,
			x: event.clientX,
			button: event.button,
			moved: false
		}
		event.currentTarget.setPointerCapture(event.pointerId)
		event.currentTarget.classList.add(styles.panning)
	}

	const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === 'touch' && isDraggingTask)
			touchPositionRef.current = { x: event.clientX, y: event.clientY }
		if (!panRef.current || panRef.current.pointerId !== event.pointerId) return
		const delta = panRef.current.x - event.clientX
		event.currentTarget.scrollLeft += delta * 1.7
		if (Math.abs(delta) > 2) panRef.current.moved = true
		panRef.current.x = event.clientX
	}

	const stopPan = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!panRef.current || panRef.current.pointerId !== event.pointerId) return
		if (panRef.current.button === 2 && panRef.current.moved)
			suppressContextMenuUntilRef.current = Date.now() + 800
		panRef.current = null
		event.currentTarget.classList.remove(styles.panning)
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
	}

	return (
		<DragDropContext
			onDragStart={() => setIsDraggingTask(true)}
			onDragEnd={result => {
				setIsDraggingTask(false)
				onDragEnd(result)
			}}
		>
			<div
				ref={boardRef}
				className={styles.board}
				onPointerDown={startPan}
				onPointerMove={movePan}
				onPointerUp={stopPan}
				onPointerCancel={stopPan}
				onContextMenu={event => {
					if (Date.now() < suppressContextMenuUntilRef.current) {
						event.preventDefault()
						suppressContextMenuUntilRef.current = 0
					}
				}}
				onAuxClick={event => {
					if (event.button === 1) event.preventDefault()
				}}
			>
				{COLUMNS.map(column => (
					<KanbanColumn
						key={column.value}
						value={column.value}
						label={column.label}
						items={items}
						setItems={setItems}
					/>
				))}
			</div>
		</DragDropContext>
	)
}
