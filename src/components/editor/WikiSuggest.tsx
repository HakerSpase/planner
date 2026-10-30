'use client'

import type { Editor } from '@tiptap/react'
import cn from 'clsx'
import { FileText } from 'lucide-react'
import { type MutableRefObject, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { type IWikiTarget, loadWikiTargets, normalizeTitle } from './wiki-links'

interface ISuggestState {
	query: string
	from: number
	to: number
	left: number
	top: number
}

/**
 * Подсказка при наборе «[[»: список листов архива, Enter/клик вставляет ссылку.
 * Клавиши ловит редактор (handleKeyDown) — через keyHandlerRef.
 */
export function WikiSuggest({
	editor,
	keyHandlerRef
}: {
	editor: Editor
	keyHandlerRef: MutableRefObject<((event: KeyboardEvent) => boolean) | null>
}) {
	const [state, setState] = useState<ISuggestState | null>(null)
	const [targets, setTargets] = useState<IWikiTarget[]>([])
	const [index, setIndex] = useState(0)

	useEffect(() => {
		const update = () => {
			if (!editor.isEditable) return setState(null)
			const { $from, empty } = editor.state.selection
			if (!empty || $from.parent.type.name === 'codeBlock') return setState(null)
			const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
			const match = /\[\[([^\[\]\n|]{0,60})$/.exec(before)
			if (!match) return setState(null)
			const from = $from.pos - match[0].length
			const coords = editor.view.coordsAtPos($from.pos)
			setState({ query: match[1], from, to: $from.pos, left: coords.left, top: coords.bottom })
		}
		editor.on('transaction', update)
		return () => {
			editor.off('transaction', update)
		}
	}, [editor])

	const isOpen = Boolean(state)
	useEffect(() => {
		if (isOpen) loadWikiTargets().then(setTargets)
	}, [isOpen])

	const matches = useMemo(() => {
		if (!state) return []
		const query = normalizeTitle(state.query)
		return targets
			.filter(page => normalizeTitle(page.title).includes(query))
			.sort((a, b) => Number(normalizeTitle(b.title).startsWith(query)) - Number(normalizeTitle(a.title).startsWith(query)))
			.slice(0, 8)
	}, [state, targets])

	useEffect(() => setIndex(0), [state?.query])

	const choose = (title: string) => {
		if (!state) return
		editor
			.chain()
			.focus()
			.insertContentAt({ from: state.from, to: state.to }, `[[${title}]]`)
			.run()
		setState(null)
	}

	keyHandlerRef.current = event => {
		if (!state) return false
		if (event.key === 'Escape') {
			setState(null)
			return true
		}
		if (!matches.length) return false
		if (event.key === 'ArrowDown') {
			setIndex(value => (value + 1) % matches.length)
			return true
		}
		if (event.key === 'ArrowUp') {
			setIndex(value => (value - 1 + matches.length) % matches.length)
			return true
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			choose(matches[index].title)
			return true
		}
		return false
	}

	if (!state || typeof document === 'undefined') return null

	const left = Math.min(state.left, window.innerWidth - 296)
	return createPortal(
		<div
			role='listbox'
			aria-label='Ссылка на лист'
			onMouseDown={event => event.preventDefault()}
			className='fixed z-[140] w-72 animate-pop-in border border-border bg-elevated p-1 shadow-pop'
			style={{ left: Math.max(8, left), top: state.top + 6 }}
		>
			<p className='px-2 pb-1 pt-1.5 font-mono text-2xs uppercase tracking-wider text-subtle'>Ссылка на лист</p>
			{matches.length ? (
				matches.map((page, position) => (
					<button
						key={page.id}
						type='button'
						role='option'
						aria-selected={position === index}
						onClick={() => choose(page.title)}
						className={cn(
							'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors',
							position === index ? 'bg-white/[0.08] text-fg' : 'text-muted hover:bg-white/[0.05]'
						)}
					>
						<FileText
							size={13}
							className='shrink-0 text-primary'
						/>
						<span className='truncate'>{page.title}</span>
					</button>
				))
			) : (
				<p className='px-2 py-2 text-xs leading-5 text-subtle'>
					{state.query ? `Листа «${state.query}» пока нет — ссылка заработает, когда он появится` : 'Начните вводить название листа'}
				</p>
			)}
		</div>,
		document.body
	)
}
