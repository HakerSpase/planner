'use client'

import { DragDropContext } from '@hello-pangea/dnd'
import { type PointerEvent as ReactPointerEvent, useRef } from 'react'

import { COLUMNS } from '../columns.data'
import { useTaskDnd } from '../hooks/useTaskDnd'
import { useTasks } from '../hooks/useTasks'

import { KanbanColumn } from './KanbanColumn'
import styles from './KanbanView.module.scss'

export function KanbanView() {
	const { items, setItems } = useTasks()
	const { onDragEnd } = useTaskDnd()
	const panRef = useRef<{
		pointerId: number
		x: number
		button: number
		moved: boolean
	} | null>(null)
	const suppressContextMenuUntilRef = useRef(0)

	const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
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
		if (!panRef.current || panRef.current.pointerId !== event.pointerId) return
		const delta = panRef.current.x - event.clientX
		event.currentTarget.scrollLeft += delta
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
		<DragDropContext onDragEnd={onDragEnd}>
			<div
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
