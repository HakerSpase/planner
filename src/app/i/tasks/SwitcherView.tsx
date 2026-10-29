'use client'

import cn from 'clsx'
import { Kanban, ListTodo } from 'lucide-react'

import type { TypeView } from './TasksView'

interface ISwitcherView {
	type: TypeView
	setType: (value: TypeView) => void
}

const VIEWS = [
	{ value: 'list', label: 'Список', icon: ListTodo },
	{ value: 'kanban', label: 'Доска', icon: Kanban }
] as const

export function SwitcherView({ setType, type }: ISwitcherView) {
	return (
		<div
			role='tablist'
			className='mb-5 inline-flex items-center divide-x divide-border border border-border'
		>
			{VIEWS.map(view => (
				<button
					key={view.value}
					role='tab'
					aria-selected={type === view.value}
					onClick={() => setType(view.value)}
					className={cn(
						'flex h-9 items-center gap-2 px-4 text-sm font-medium transition-colors',
						type === view.value
							? 'bg-white/[0.06] text-fg'
							: 'text-muted hover:text-fg'
					)}
				>
					<view.icon size={15} />
					{view.label}
				</button>
			))}
		</div>
	)
}
