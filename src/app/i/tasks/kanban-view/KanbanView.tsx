'use client'

import { DragDropContext } from '@hello-pangea/dnd'
import cn from 'clsx'
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
	const { onDragEnd } = useTaskDnd(items, setItems)
	const [isDraggingTask, setIsDraggingTask] = useState(false)
	const boardRef = useRef<HTMLDivElement>(null)
	const dragPositionRef = useRef<{ x: number; y: number } | null>(null)
	const panRef = useRef<{
		pointerId: number
		x: number
		button: number
		moved: boolean
	} | null>(null)
	const suppressContextMenuUntilRef = useRef(0)

	useEffect(() => {
		if (!isDraggingTask) return

		const trackPointer = (event: PointerEvent | MouseEvent) => {
			dragPositionRef.current = { x: event.clientX, y: event.clientY }
		}

		const trackTouch = (event: TouchEvent) => {
			const touch = event.touches[0] || event.changedTouches[0]
			if (touch) {
				dragPositionRef.current = { x: touch.clientX, y: touch.clientY }
			}
		}

		const clearPosition = () => {
			dragPositionRef.current = null
		}

		window.addEventListener('pointermove', trackPointer, {
			capture: true,
			passive: true
		})
		window.addEventListener('mousemove', trackPointer, {
			capture: true,
			passive: true
		})
		window.addEventListener('touchmove', trackTouch, {
			capture: true,
			passive: true
		})
		window.addEventListener('pointerup', clearPosition, true)
		window.addEventListener('mouseup', clearPosition, true)
		window.addEventListener('touchend', clearPosition, true)
		window.addEventListener('touchcancel', clearPosition, true)

		let frame = 0
		const autoScroll = () => {
			const point = dragPositionRef.current
			const board = boardRef.current
			if (point && board) {
				const bounds = board.getBoundingClientRect()
				const pageScroller = board.closest('main')
				const pageBounds = pageScroller?.getBoundingClientRect()
				const edge = 90

				if (board.scrollWidth > board.clientWidth) {
					if (point.x > bounds.right - edge) {
						const distance = point.x - (bounds.right - edge)
						const ratio = Math.min(1.0, Math.max(0.15, distance / edge))
						board.scrollLeft += Math.max(1, Math.round(ratio * 7))
					} else if (point.x < bounds.left + edge) {
						const distance = bounds.left + edge - point.x
						const ratio = Math.min(1.0, Math.max(0.15, distance / edge))
						board.scrollLeft -= Math.max(1, Math.round(ratio * 7))
					}
				}

				if (pageScroller && pageBounds) {
					if (point.y > pageBounds.bottom - edge) {
						const distance = point.y - (pageBounds.bottom - edge)
						const ratio = Math.min(1.0, Math.max(0.15, distance / edge))
						pageScroller.scrollTop += Math.max(1, Math.round(ratio * 8))
					} else if (point.y < pageBounds.top + edge) {
						const distance = pageBounds.top + edge - point.y
						const ratio = Math.min(1.0, Math.max(0.15, distance / edge))
						pageScroller.scrollTop -= Math.max(1, Math.round(ratio * 8))
					}
				}
			}
			frame = window.requestAnimationFrame(autoScroll)
		}
		frame = window.requestAnimationFrame(autoScroll)

		return () => {
			window.cancelAnimationFrame(frame)
			window.removeEventListener('pointermove', trackPointer, true)
			window.removeEventListener('mousemove', trackPointer, true)
			window.removeEventListener('touchmove', trackTouch, true)
			window.removeEventListener('pointerup', clearPosition, true)
			window.removeEventListener('mouseup', clearPosition, true)
			window.removeEventListener('touchend', clearPosition, true)
			window.removeEventListener('touchcancel', clearPosition, true)
			dragPositionRef.current = null
		}
	}, [isDraggingTask])

	const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.pointerType === 'touch') {
			dragPositionRef.current = { x: event.clientX, y: event.clientY }
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
		if (event.pointerType === 'touch' && isDraggingTask) {
			dragPositionRef.current = { x: event.clientX, y: event.clientY }
		}
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
				className={cn(styles.board, isDraggingTask && styles.dragging)}
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
