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
		<div className='relative mb-4 inline-flex min-w-0 items-center border-b border-white/[0.08] sm:mb-5'>
			<button
				className={cn(
					'flex min-h-11 w-28 shrink-0 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm transition-colors',
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
					'flex min-h-11 w-28 shrink-0 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm transition-colors',
					{
						'opacity-40': type === 'list'
					}
				)}
				onClick={() => setType('kanban')}
			>
				<Kanban />
				Доска
			</button>
			<span className={cn('pointer-events-none absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out', type === 'list' ? 'left-0 w-1/2' : 'left-1/2 w-1/2')} />
		</div>
	)
}
