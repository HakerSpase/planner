'use client'

import cn from 'clsx'
import { Columns2, FileText, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * Вкладки архива: открытые листы всегда под рукой, как в браузере. Живут на этом устройстве.
 * На большом экране лист можно открыть рядом — до двух панелей.
 */

export interface ILibraryTab {
	pageId: string
	topicId: string
	title: string
}

interface ITabsState {
	tabs: ILibraryTab[]
	/** Что в правой панели: id листа, EMPTY_PANE — панель открыта, лист не выбран */
	split: string | null
}

export const EMPTY_PANE = 'empty'

const STORAGE_KEY = 'planner:library:tabs'
const MAX_TABS = 20

export function useLibraryTabs() {
	const [state, setState] = useState<ITabsState>({ tabs: [], split: null })
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
			if (saved && Array.isArray(saved.tabs))
				setState({ tabs: saved.tabs, split: saved.split ?? null })
		} catch {}
		setLoaded(true)
	}, [])

	useEffect(() => {
		if (!loaded) return
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
		} catch {}
	}, [state, loaded])

	const open = useCallback((pageId: string, topicId: string) => {
		setState(current => {
			if (current.tabs.some(tab => tab.pageId === pageId)) return current
			const tabs = [...current.tabs, { pageId, topicId, title: '' }]
			// Слишком много — закрываем самую старую, кроме той, что в правой панели
			if (tabs.length > MAX_TABS) {
				const oldest = tabs.findIndex(tab => tab.pageId !== current.split)
				tabs.splice(oldest, 1)
			}
			return { ...current, tabs }
		})
	}, [])

	const setTitle = useCallback((pageId: string, title: string) => {
		setState(current =>
			current.tabs.some(tab => tab.pageId === pageId && tab.title !== title)
				? {
						...current,
						tabs: current.tabs.map(tab =>
							tab.pageId === pageId ? { ...tab, title } : tab
						)
					}
				: current
		)
	}, [])

	const remove = useCallback((ids: string[]) => {
		setState(current => ({
			tabs: current.tabs.filter(tab => !ids.includes(tab.pageId)),
			split: current.split && ids.includes(current.split) ? null : current.split
		}))
	}, [])

	const setSplit = useCallback((split: string | null) => {
		setState(current => (current.split === split ? current : { ...current, split }))
	}, [])

	return { ...state, loaded, open, setTitle, remove, setSplit }
}

/** Экран достаточно большой для двух панелей */
export function useCanSplit() {
	const [can, setCan] = useState(false)
	useEffect(() => {
		const query = window.matchMedia('(min-width: 1024px)')
		const update = () => setCan(query.matches)
		update()
		query.addEventListener('change', update)
		return () => query.removeEventListener('change', update)
	}, [])
	return can
}

export function LibraryTabBar({
	tabs,
	activeId,
	rightId,
	focusedRight,
	canSplit,
	onSelect,
	onClose,
	onCloseAll,
	onOpenBeside,
	onToggleSplit
}: {
	tabs: ILibraryTab[]
	activeId: string | null
	rightId: string | null
	focusedRight: boolean
	canSplit: boolean
	onSelect: (tab: ILibraryTab) => void
	onClose: (tab: ILibraryTab) => void
	onCloseAll: () => void
	onOpenBeside: (tab: ILibraryTab) => void
	onToggleSplit: () => void
}) {
	const listRef = useRef<HTMLDivElement>(null)
	const focusedId = focusedRight ? rightId : activeId

	// Активная вкладка всегда в зоне видимости
	useEffect(() => {
		listRef.current
			?.querySelector('[data-focused="true"]')
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
	}, [focusedId, tabs.length])

	return (
		<div className='sticky top-[calc(-1*max(0.5rem,env(safe-area-inset-top)))] z-30 -mx-4 flex h-10 items-stretch border-b border-border bg-bg print:hidden sm:-mx-6 lg:-top-3 lg:-mx-8 xl:-mx-10'>
			<div
				ref={listRef}
				role='tablist'
				aria-label='Открытые листы'
				className='flex min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
			>
				{tabs.map(tab => {
					const isOpen = tab.pageId === activeId || tab.pageId === rightId
					const focused = tab.pageId === focusedId
					return (
						<div
							key={tab.pageId}
							data-focused={focused}
							className={cn(
								'group relative flex w-44 min-w-[9rem] max-w-[11rem] shrink-0 items-center border-r border-border transition-colors',
								isOpen ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
							)}
							onAuxClick={event => {
								if (event.button !== 1) return
								event.preventDefault()
								onClose(tab)
							}}
						>
							{focused && (
								<span className='absolute inset-x-0 top-0 h-0.5 bg-primary' />
							)}
							<button
								type='button'
								role='tab'
								aria-selected={isOpen}
								title={tab.title || 'Без названия'}
								onClick={() => onSelect(tab)}
								className={cn(
									'flex h-full min-w-0 flex-1 items-center gap-2 pl-3 text-left text-[13px]',
									isOpen ? 'text-fg' : 'text-muted group-hover:text-fg'
								)}
							>
								<FileText
									size={13}
									className={cn('shrink-0', focused ? 'text-primary' : 'text-subtle')}
								/>
								<span className='truncate'>{tab.title || 'Без названия'}</span>
							</button>
							{canSplit && !isOpen && (
								<button
									type='button'
									onClick={() => onOpenBeside(tab)}
									title='Открыть рядом'
									aria-label={`Открыть рядом: ${tab.title || 'Без названия'}`}
									className='grid h-6 w-6 shrink-0 place-items-center text-subtle opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100'
								>
									<Columns2 size={13} />
								</button>
							)}
							<button
								type='button'
								onClick={() => onClose(tab)}
								title='Закрыть вкладку'
								aria-label={`Закрыть вкладку: ${tab.title || 'Без названия'}`}
								className={cn(
									'mr-1 grid h-6 w-6 shrink-0 place-items-center text-subtle transition-opacity hover:bg-white/[0.08] hover:text-fg focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
									isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
								)}
							>
								<X size={13} />
							</button>
						</div>
					)
				})}
			</div>
			<div className='flex shrink-0 items-center gap-0.5 border-l border-border px-1'>
				{canSplit && (
					<button
						type='button'
						onClick={onToggleSplit}
						aria-pressed={Boolean(rightId)}
						title={rightId ? 'Закрыть вторую панель' : 'Открыть вторую панель'}
						aria-label={rightId ? 'Закрыть вторую панель' : 'Открыть вторую панель'}
						className={cn(
							'grid h-8 w-8 place-items-center transition-colors hover:bg-white/[0.06]',
							rightId ? 'text-primary' : 'text-subtle hover:text-fg'
						)}
					>
						<Columns2 size={15} />
					</button>
				)}
				{tabs.length > 1 && (
					<button
						type='button'
						onClick={onCloseAll}
						title='Закрыть все вкладки'
						aria-label='Закрыть все вкладки'
						className='grid h-8 w-8 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<X size={15} />
					</button>
				)}
			</div>
		</div>
	)
}

/** Панели занимают всю высоту окна под вкладками; прокручивается каждая сама */
export function useFillHeight() {
	const ref = useRef<HTMLDivElement>(null)
	const [height, setHeight] = useState<number>()
	useEffect(() => {
		const update = () => {
			const element = ref.current
			if (!element) return
			const scroller = element.closest<HTMLElement>('main')
			const tabs = 40
			const top = scroller?.getBoundingClientRect().top ?? 0
			setHeight(window.innerHeight - top - tabs - 12)
		}
		update()
		window.addEventListener('resize', update)
		return () => window.removeEventListener('resize', update)
	}, [])
	return { ref, height }
}
