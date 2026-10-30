'use client'

import { useQuery } from '@tanstack/react-query'
import cn from 'clsx'
import { AudioLines, Check, Copy, Eye, Link2, ListTree, MoreHorizontal, Printer, Trash2, Unlink, X } from 'lucide-react'
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { MathExcerpt } from '@/components/editor/MathExcerpt'
import { normalizeTitle } from '@/components/editor/wiki-links'
import { useBackClose } from '@/hooks/useBackClose'

import { createClient } from '@/lib/supabase/client'

import { libraryService, toExcerpt } from '@/services/library.service'

/* ------------------------------------------------------------------ */
/* Оглавление листа                                                     */
/* ------------------------------------------------------------------ */

export interface IHeading {
	level: number
	text: string
	element: HTMLElement
}

/** Заголовки из отрисованного листа; обновляются, когда меняется текст */
export function useHeadings(rootRef: RefObject<HTMLElement>, version: unknown) {
	const [headings, setHeadings] = useState<IHeading[]>([])
	useEffect(() => {
		const root = rootRef.current
		if (!root) return
		const read = () =>
			setHeadings(
				Array.from(root.querySelectorAll<HTMLElement>('.ProseMirror > h1, .ProseMirror > h2, .ProseMirror > h3'))
					.filter(element => element.textContent?.trim())
					.map(element => ({
						level: Number(element.tagName[1]),
						text: element.textContent!.trim(),
						element
					}))
			)
		read()
		const observer = new MutationObserver(() => read())
		observer.observe(root, { childList: true, subtree: true, characterData: true })
		return () => observer.disconnect()
	}, [rootRef, version])
	return headings
}

/** Какие разделы сейчас на экране — подсвечиваем все видимые, а не только последний */
function useActiveHeading(headings: IHeading[]) {
	const [active, setActive] = useState<number[]>([0])
	useEffect(() => {
		if (!headings.length) return
		const scroller = headings[0].element.closest<HTMLElement>('[data-scroll-root], main')
		const update = () => {
			const top = 72
			const bottom = window.innerHeight
			const visible: number[] = []
			headings.forEach((heading, i) => {
				const start = heading.element.getBoundingClientRect().top
				const end = headings[i + 1]?.element.getBoundingClientRect().top ?? Infinity
				if (end > top + 24 && start < bottom - 40) visible.push(i)
			})
			setActive(visible.length ? visible : [0])
		}
		update()
		scroller?.addEventListener('scroll', update, { passive: true })
		return () => scroller?.removeEventListener('scroll', update)
	}, [headings])
	return active
}

const scrollToHeading = (heading: IHeading) => {
	heading.element.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function PageOutline({ headings, onPick }: { headings: IHeading[]; onPick?: () => void }) {
	const active = useActiveHeading(headings)
	const minLevel = Math.min(...headings.map(heading => heading.level))
	if (!headings.length)
		return <p className='text-xs leading-5 text-subtle'>Заголовков нет — добавьте их кнопками H1/H2 при правке.</p>
	return (
		<nav aria-label='Содержание листа'>
			<ul className='space-y-0.5 border-l border-border'>
				{headings.map((heading, index) => (
					<li key={`${index}:${heading.text}`}>
						<button
							type='button'
							onClick={() => {
								scrollToHeading(heading)
								onPick?.()
							}}
							className={cn(
								'-ml-px block w-full border-l-2 py-1 pr-2 text-left text-[13px] leading-5 transition-colors',
								active.includes(index)
									? 'border-primary text-fg'
									: 'border-transparent text-subtle hover:text-fg'
							)}
							style={{ paddingLeft: `${0.75 + (heading.level - minLevel) * 0.75}rem` }}
						>
							{heading.text}
						</button>
					</li>
				))}
			</ul>
		</nav>
	)
}

/** Полоска прочитанного под шапкой листа */
export function ReadingProgress({ anchorRef }: { anchorRef: RefObject<HTMLElement> }) {
	const barRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const scroller = anchorRef.current?.closest<HTMLElement>('[data-scroll-root], main')
		if (!scroller) return
		const update = () => {
			const max = scroller.scrollHeight - scroller.clientHeight
			const value = max > 0 ? scroller.scrollTop / max : 0
			if (barRef.current) barRef.current.style.transform = `scaleX(${value})`
		}
		update()
		scroller.addEventListener('scroll', update, { passive: true })
		return () => scroller.removeEventListener('scroll', update)
	}, [anchorRef])
	return (
		<div
			ref={barRef}
			className='absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary/80'
			style={{ transform: 'scaleX(0)' }}
		/>
	)
}

/* ------------------------------------------------------------------ */
/* Обратные ссылки                                                      */
/* ------------------------------------------------------------------ */

export function PageBacklinks({
	pageId,
	title,
	onOpen
}: {
	pageId: string
	title: string
	onOpen: (topicId: string, pageId: string) => void
}) {
	const { data: pages } = useQuery({
		queryKey: ['library', 'graph-index'],
		queryFn: libraryService.getSearchIndex,
		staleTime: 60_000
	})

	const backlinks = useMemo(() => {
		const key = normalizeTitle(title)
		if (!key || !pages) return []
		return pages
			.filter(page => page.id !== pageId)
			.map(page => {
				const match = Array.from(page.content.matchAll(/\[\[([^\[\]\n|]+)(?:\|[^\[\]\n]*)?\]\]/g)).find(
					item => normalizeTitle(item[1]) === key
				)
				if (!match) return null
				// Кусочек текста вокруг ссылки
				const start = Math.max(0, (match.index ?? 0) - 120)
				const context = toExcerpt(page.content.slice(start, (match.index ?? 0) + match[0].length + 120), 200)
				return { page, context }
			})
			.filter(Boolean) as { page: (typeof pages)[number]; context: string }[]
	}, [pages, pageId, title])

	if (!backlinks.length) return null
	return (
		<section className='mt-12 border-t border-border pt-6'>
			<h2 className='eyebrow mb-3'>Ссылаются на этот лист · {backlinks.length}</h2>
			<ul className='grid gap-2 sm:grid-cols-2'>
				{backlinks.map(({ page, context }) => (
					<li key={page.id}>
						<button
							type='button'
							onClick={() => onOpen(page.topic_id, page.id)}
							className='block h-full w-full border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/50'
						>
							<span className='block truncate text-sm font-medium text-fg'>{page.title || 'Без названия'}</span>
							<span className='mt-1 line-clamp-2 text-xs leading-5 text-subtle'>
								<MathExcerpt text={context} />
							</span>
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* Меню листа: проверка, содержание, печать, ссылка                     */
/* ------------------------------------------------------------------ */

export function PageMenu({
	selfCheck,
	onToggleSelfCheck,
	onOpenOutline,
	showOutline,
	onToggleOutline,
	onShare,
	onSpeak,
	onDelete
}: {
	selfCheck: boolean
	onToggleSelfCheck: () => void
	onOpenOutline: () => void
	showOutline?: boolean
	onToggleOutline?: () => void
	onShare: () => void
	onSpeak?: () => void
	onDelete: () => void
}) {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)
	const [menuLeft, setMenuLeft] = useState<number | undefined>(undefined)

	useEffect(() => {
		if (!open) {
			setMenuLeft(undefined)
			return
		}
		const updatePosition = () => {
			const root = rootRef.current
			if (!root) return
			const rect = root.getBoundingClientRect()
			const menuWidth = Math.min(256, window.innerWidth - 16)
			const idealLeft = rect.right - menuWidth
			const clampedLeft = Math.max(8, Math.min(idealLeft, window.innerWidth - menuWidth - 8))
			setMenuLeft(clampedLeft - rect.left)
		}
		updatePosition()
		window.addEventListener('resize', updatePosition)
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', close)
		return () => {
			window.removeEventListener('resize', updatePosition)
			document.removeEventListener('pointerdown', close)
		}
	}, [open])

	const items = [
		{ icon: Eye, label: selfCheck ? 'Выключить проверку' : 'Режим проверки', hint: 'Закрыть ответы и формулы', action: onToggleSelfCheck },
		{ icon: ListTree, label: 'Содержание', hint: 'Перейти к разделу листа', action: onOpenOutline, mobileOnly: true },
		...(onToggleOutline
			? [
					{
						icon: ListTree,
						label: showOutline ? 'Скрыть содержание' : 'Показать содержание',
						hint: 'Боковая панель справа',
						action: onToggleOutline,
						desktopOnly: true
					}
				]
			: []),
		...(onSpeak ? [{ icon: AudioLines, label: 'Озвучить лист', hint: 'Прочитать вслух, без формул', action: onSpeak }] : []),
		{ icon: Printer, label: 'Печать или PDF', hint: 'Сохранить как PDF в окне печати', action: () => window.print() },
		{ icon: Link2, label: 'Поделиться ссылкой', hint: 'Только для чтения', action: onShare },
		{ icon: Trash2, label: 'Удалить лист', hint: '', action: onDelete, danger: true }
	]

	return (
		<div
			ref={rootRef}
			className='relative'
		>
			<button
				type='button'
				aria-label='Ещё'
				aria-expanded={open}
				onClick={() => setOpen(value => !value)}
				className={cn(
					'grid h-9 w-9 place-items-center transition-colors hover:bg-white/[0.06]',
					open || selfCheck ? 'text-fg' : 'text-subtle'
				)}
			>
				<MoreHorizontal size={17} />
			</button>
			{open && (
				<div
					role='menu'
					style={menuLeft !== undefined ? { left: menuLeft, right: 'auto' } : undefined}
					className='absolute right-0 top-full z-40 mt-1 w-64 max-w-[calc(100vw-1rem)] animate-pop-in border border-border bg-elevated p-1 shadow-pop'
				>
					{items.map(({ icon: Icon, label, hint, action, danger, mobileOnly, desktopOnly }) => (
						<button
							key={label}
							type='button'
							role='menuitem'
							onClick={() => {
								setOpen(false)
								action()
							}}
							className={cn(
								'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]',
								mobileOnly && 'xl:hidden',
								desktopOnly && 'hidden xl:flex'
							)}
						>
							<Icon
								size={15}
								className={cn('mt-0.5 shrink-0', danger ? 'text-danger' : 'text-subtle')}
							/>
							<span>
								<span className={cn('block text-sm', danger ? 'text-danger' : 'text-fg')}>{label}</span>
								{hint && <span className='block text-xs text-subtle'>{hint}</span>}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}

/** Нижняя «шторка» с содержанием — на телефоне и узких экранах */
export function OutlineSheet({ headings, onClose }: { headings: IHeading[]; onClose: () => void }) {
	useBackClose(true, onClose)
	if (typeof document === 'undefined') return null
	return createPortal(
		<div
			className='fixed inset-0 z-[110] flex animate-fade-in items-end bg-black/50 sm:items-center sm:justify-center'
			onMouseDown={event => event.target === event.currentTarget && onClose()}
		>
			<div className='max-h-[75dvh] w-full overflow-y-auto border-t border-border bg-elevated p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-md sm:border'>
				<div className='mb-3 flex items-center justify-between'>
					<p className='eyebrow'>Содержание</p>
					<button
						type='button'
						onClick={onClose}
						aria-label='Закрыть'
						className='grid h-8 w-8 place-items-center text-subtle hover:text-fg'
					>
						<X size={16} />
					</button>
				</div>
				<PageOutline
					headings={headings}
					onPick={onClose}
				/>
			</div>
		</div>,
		document.body
	)
}

/* ------------------------------------------------------------------ */
/* Публичная ссылка                                                     */
/* ------------------------------------------------------------------ */

export function ShareDialog({ pageId, onClose }: { pageId: string; onClose: () => void }) {
	useBackClose(true, onClose)
	const [token, setToken] = useState<string | null | undefined>(undefined)
	const [busy, setBusy] = useState(false)
	const [copied, setCopied] = useState(false)
	const db = useMemo(() => createClient(), [])

	useEffect(() => {
		db.from('library_share')
			.select('token')
			.eq('page_id', pageId)
			.maybeSingle()
			.then(({ data }) => setToken(data?.token ?? null))
	}, [db, pageId])

	const url = token ? `${window.location.origin}/share/${token}` : ''

	const create = async () => {
		setBusy(true)
		const { data, error } = await db.from('library_share').insert({ page_id: pageId }).select('token').single()
		setBusy(false)
		if (error) return toast.error('Не получилось создать ссылку')
		setToken(data.token)
	}

	const revoke = async () => {
		setBusy(true)
		const { error } = await db.from('library_share').delete().eq('page_id', pageId)
		setBusy(false)
		if (error) return toast.error('Не получилось закрыть доступ')
		setToken(null)
		toast.success('Ссылка больше не работает')
	}

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Не получилось скопировать')
		}
	}

	if (typeof document === 'undefined') return null
	return createPortal(
		<div
			className='fixed inset-0 z-[110] flex animate-fade-in items-center justify-center bg-black/60 p-4'
			onMouseDown={event => event.target === event.currentTarget && onClose()}
		>
			<section className='w-full max-w-md animate-pop-in border border-border bg-elevated p-5 shadow-pop'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<h2 className='text-base font-semibold text-fg'>Поделиться листом</h2>
						<p className='mt-1 text-sm leading-5 text-muted'>
							По ссылке лист откроется только для чтения — без входа и без доступа к остальному архиву.
						</p>
					</div>
					<button
						type='button'
						onClick={onClose}
						aria-label='Закрыть'
						className='grid h-8 w-8 shrink-0 place-items-center text-subtle hover:text-fg'
					>
						<X size={16} />
					</button>
				</div>

				<div className='mt-4'>
					{token === undefined ? (
						<div className='h-10 animate-pulse bg-white/[0.04]' />
					) : token ? (
						<>
							<div className='flex border border-border bg-bg'>
								<input
									readOnly
									value={url}
									onFocus={event => event.currentTarget.select()}
									className='min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-fg outline-none'
								/>
								<button
									type='button'
									onClick={copy}
									className='flex h-10 shrink-0 items-center gap-1.5 bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover'
								>
									{copied ? <Check size={14} /> : <Copy size={14} />}
									{copied ? 'Готово' : 'Копировать'}
								</button>
							</div>
							<button
								type='button'
								disabled={busy}
								onClick={revoke}
								className='mt-3 flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-danger disabled:opacity-50'
							>
								<Unlink size={13} />
								Закрыть доступ по ссылке
							</button>
						</>
					) : (
						<button
							type='button'
							disabled={busy}
							onClick={create}
							className='flex h-10 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50'
						>
							<Link2 size={15} />
							Создать ссылку
						</button>
					)}
				</div>
			</section>
		</div>,
		document.body
	)
}
