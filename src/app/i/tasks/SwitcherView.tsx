'use client'

import cn from 'clsx'
import { Kanban, ListTodo } from 'lucide-react'

import type { TypeView } from './TasksView'

interface ISwitcherView {
	type: TypeView
	setType: (value: TypeView) => void
}

export function SwitcherView({ setType, type }: ISwitcherView) {
	return (
		<div className='mb-4 flex min-w-0 items-center gap-4 overflow-x-auto border-b border-white/[0.08] sm:mb-5'>
			<button
				className={cn(
					'flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors',
					{
						'opacity-40': type === 'kanban'
					}
				)}
				onClick={() => setType('list')}
			>
				<ListTodo />
				Список
			</button>
			<button
				className={cn(
					'flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors',
					{
						'opacity-40': type === 'list'
					}
				)}
				onClick={() => setType('kanban')}
			>
				<Kanban />
				Доска
			</button>
		</div>
	)
}
