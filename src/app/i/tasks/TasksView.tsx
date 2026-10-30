'use client'

import { useEffect } from 'react'

import Loader from '@/components/ui/Loader'

import { useLocalStorage } from '@/hooks/useLocalStorage'

import { QuickAddTask } from './QuickAddTask'
import { SwitcherView } from './SwitcherView'
import { KanbanView } from './kanban-view/KanbanView'
import { ListView } from './list-view/ListView'

export type TypeView = 'list' | 'kanban'

export function TasksView() {
	const [type, setType, isLoading] = useLocalStorage<TypeView>({
		key: 'view-type',
		defaultValue: 'list'
	})

	// Пришли из поиска (#task-…) — дождаться задачи, прокрутить к ней и подсветить
	useEffect(() => {
		if (isLoading) return
		let timer: ReturnType<typeof setInterval> | undefined
		const flash = (id: string) => {
			clearInterval(timer)
			let tries = 0
			timer = setInterval(() => {
				const element = Array.from(
					document.querySelectorAll<HTMLElement>(
						`[data-task-id="${CSS.escape(id)}"]`
					)
				).find(item => item.offsetParent)
				if (!element && ++tries < 40) return
				clearInterval(timer)
				if (!element) return
				element.scrollIntoView({ behavior: 'smooth', block: 'center' })
				element.classList.add('search-flash')
				setTimeout(() => element.classList.remove('search-flash'), 2200)
				history.replaceState(null, '', window.location.pathname)
			}, 150)
		}
		const fromHash = () => {
			const id = window.location.hash.match(/^#task-(.+)$/)?.[1]
			if (id) flash(id)
		}
		fromHash()
		window.addEventListener('hashchange', fromHash)
		window.addEventListener('planner:flash-task', fromHash)
		return () => {
			clearInterval(timer)
			window.removeEventListener('hashchange', fromHash)
			window.removeEventListener('planner:flash-task', fromHash)
		}
	}, [isLoading, type])

	if (isLoading) return <Loader />

	return (
		<div>
			<QuickAddTask />
			<SwitcherView
				setType={setType}
				type={type}
			/>
			{type === 'list' ? <ListView /> : <KanbanView />}
		</div>
	)
}
