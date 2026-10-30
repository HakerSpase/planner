'use client'

import type { Editor } from '@tiptap/react'
import cn from 'clsx'
import { MessageSquareQuote } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CALLOUT_TYPES } from './study'

/** Кнопка панели: вставить цветную выноску («Правило», «Пример», «Ошибка»…) или карточку */
export function CalloutMenu({ editor }: { editor: Editor }) {
	const [open, setOpen] = useState(false)
	const [collapsible, setCollapsible] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', close)
		return () => document.removeEventListener('pointerdown', close)
	}, [open])

	const insert = (type: string, label: string) => {
		const { from, to, empty } = editor.state.selection
		// Выделенный текст становится содержимым выноски
		const selected = empty ? '' : editor.state.doc.textBetween(from, to, '\n')
		editor
			.chain()
			.focus()
			.insertContentAt(
				{ from, to },
				{
					type: 'blockquote',
					content: [
						{ type: 'paragraph', content: [{ type: 'text', text: `[!${type}]${collapsible ? '-' : ''} ${label}` }] },
						selected
							? { type: 'paragraph', content: [{ type: 'text', text: selected }] }
							: { type: 'paragraph' }
					]
				}
			)
			.run()
		setOpen(false)
	}

	const insertCard = () => {
		editor.chain().focus().insertContent('Вопрос :: Ответ').run()
		setOpen(false)
	}

	return (
		<div
			ref={rootRef}
			className='contents'
		>
			<button
				type='button'
				title='Выноска: правило, пример, ошибка…'
				aria-label='Вставить выноску'
				aria-expanded={open}
				onMouseDown={event => event.preventDefault()}
				onClick={() => setOpen(value => !value)}
				className={cn(
					'grid h-8 w-8 place-items-center transition-colors',
					open ? 'bg-white/[0.08] text-fg' : 'text-subtle hover:bg-white/[0.04] hover:text-fg'
				)}
			>
				<MessageSquareQuote size={15} />
			</button>
			{open && (
				<div
					onMouseDown={event => {
						if (!(event.target as HTMLElement).closest('input')) event.preventDefault()
					}}
					className='absolute inset-x-1 top-full z-30 mt-1 animate-pop-in border border-border bg-elevated p-2 shadow-pop sm:left-auto sm:w-[22rem]'
				>
					<div className='grid grid-cols-2 gap-1'>
						{CALLOUT_TYPES.map(({ type, label, color }) => (
							<button
								key={type}
								type='button'
								onClick={() => insert(type, label)}
								className='flex items-center gap-2 border-l-2 bg-white/[0.03] px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-white/[0.07]'
								style={{ borderColor: `rgb(${color})` }}
							>
								{label}
							</button>
						))}
					</div>
					<label className='mt-2 flex items-center gap-2 px-1 text-xs text-muted'>
						<input
							type='checkbox'
							checked={collapsible}
							onChange={event => setCollapsible(event.target.checked)}
							className='accent-primary'
						/>
						Свёрнутой — раскрывается нажатием
					</label>
					<button
						type='button'
						onClick={insertCard}
						className='mt-2 w-full border border-dashed border-white/15 px-3 py-2 text-left text-sm text-muted transition-colors hover:text-fg'
					>
						<span className='text-fg'>Карточка для повторения</span>
						<span className='block text-xs text-subtle'>«Вопрос :: Ответ» — попадёт в тренировку</span>
					</button>
				</div>
			)}
		</div>
	)
}
