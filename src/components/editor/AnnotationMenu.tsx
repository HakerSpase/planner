'use client'

import type { Editor } from '@tiptap/react'
import cn from 'clsx'
import { Eraser, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
	ANNOTATION_MARKS,
	HIDDEN_TEXT,
	HIGHLIGHTS,
	type IAnnotation,
	MORPHEMES,
	PARTS_OF_SPEECH,
	SYNTAX_ROLES,
	TEXT_COLORS,
	markNameFor,
	resolveAnnotation
} from './annotations'

// Буквы любого алфавита, цифры, ударение и дефис
const WORD_CHAR = new RegExp('[\\p{L}\\p{N}\\u0301-]', 'u')

/** Нет выделения — берём слово под курсором: на телефоне так проще всего */
function selectionOrWord(editor: Editor) {
	const { from, to, $from } = editor.state.selection
	if (from !== to) return { from, to }
	const text = $from.parent.textContent
	const offset = $from.parentOffset
	let start = offset
	let end = offset
	while (start > 0 && WORD_CHAR.test(text[start - 1])) start--
	while (end < text.length && WORD_CHAR.test(text[end])) end++
	if (start === end) return null
	const base = from - offset
	return { from: base + start, to: base + end }
}

function isApplied(editor: Editor, annotation: IAnnotation) {
	return editor.isActive(markNameFor(annotation.group), { code: annotation.code })
}

function apply(editor: Editor, annotation: IAnnotation) {
	const range = selectionOrWord(editor)
	const name = markNameFor(annotation.group)
	const active = isApplied(editor, annotation)
	if (!range) {
		// Пустое место: цвет «включается» для следующего набранного текста
		if (annotation.group === 'color' || annotation.group === 'highlight')
			editor.chain().focus().setMark(name, { code: annotation.code }).run()
		return
	}
	editor
		.chain()
		.focus()
		.command(({ tr, state }) => {
			const type = state.schema.marks[name]
			const mark = type.create({ code: annotation.code })
			if (active) tr.removeMark(range.from, range.to, mark)
			else {
				// Морфемы накладываются (основа поверх корня), остальное заменяет прежнюю пометку
				if (annotation.group !== 'morpheme') tr.removeMark(range.from, range.to, type)
				tr.addMark(range.from, range.to, mark)
			}
			return true
		})
		.run()
}

function clearAll(editor: Editor) {
	const range = selectionOrWord(editor)
	if (!range) return
	editor
		.chain()
		.focus()
		.command(({ tr, state }) => {
			ANNOTATION_MARKS.forEach(mark => tr.removeMark(range.from, range.to, state.schema.marks[mark.name]))
			return true
		})
		.run()
}

export function AnnotationMenu({ editor }: { editor: Editor }) {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [open])

	const choose = (annotation: IAnnotation) => {
		apply(editor, annotation)
		setOpen(false)
	}

	const hasAny = ANNOTATION_MARKS.some(mark => editor.isActive(mark.name))
	const activeColor = TEXT_COLORS.find(item => isApplied(editor, item))

	return (
		<div
			ref={rootRef}
			className='contents'
		>
			<button
				type='button'
				title='Оформление: цвет, разбор предложения и слова'
				aria-label='Оформление текста'
				aria-expanded={open}
				onMouseDown={event => event.preventDefault()}
				onClick={() => setOpen(value => !value)}
				className={cn(
					'relative grid h-8 w-8 place-items-center transition-colors',
					open || hasAny ? 'bg-white/[0.08] text-fg' : 'text-subtle hover:bg-white/[0.04] hover:text-fg'
				)}
			>
				<Palette size={15} />
				<span
					className='absolute inset-x-2 bottom-1 h-0.5'
					style={{ background: activeColor?.color || 'transparent' }}
				/>
			</button>

			{open && (
				<div
					role='dialog'
					aria-label='Оформление текста'
					onMouseDown={event => {
						// не теряем выделение в тексте, но даём работать полю выбора цвета
						if (!(event.target as HTMLElement).closest('input')) event.preventDefault()
					}}
					className='absolute inset-x-1 top-full z-30 mt-1 max-h-[min(70vh,34rem)] animate-pop-in overflow-y-auto overscroll-contain border border-border bg-elevated p-3 shadow-pop sm:left-auto sm:w-[25rem]'
				>
					<p className='mb-2 text-xs leading-5 text-subtle'>
						Выделите текст или поставьте курсор в слово.
					</p>

					<button
						type='button'
						aria-pressed={isApplied(editor, HIDDEN_TEXT)}
						onClick={() => choose(HIDDEN_TEXT)}
						className={cn(
							'mb-3 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
							isApplied(editor, HIDDEN_TEXT) ? 'bg-primary/15' : 'bg-white/[0.03] hover:bg-white/[0.07]'
						)}
					>
						<span className='annot annot-hidden shrink-0 px-2 text-sm'>ответ</span>
						<span>
							<span className='block text-sm text-fg'>Скрыть до нажатия</span>
							<span className='block text-xs text-subtle'>Для самопроверки: закрывает ответ, формулу, термин</span>
						</span>
					</button>

					<Group title='Цвет текста'>
						<div className='flex flex-wrap items-center gap-1.5'>
							{TEXT_COLORS.map(item => (
								<Swatch
									key={item.code}
									annotation={item}
									active={isApplied(editor, item)}
									onClick={() => choose(item)}
								/>
							))}
							<label
								title='Свой цвет'
								className='relative grid h-7 w-7 cursor-pointer place-items-center border border-dashed border-white/25 text-xs text-subtle hover:text-fg'
							>
								+
								<input
									type='color'
									className='absolute inset-0 cursor-pointer opacity-0'
									onChange={event => {
										const custom = resolveAnnotation(event.target.value)
										if (custom) choose(custom)
									}}
								/>
							</label>
						</div>
					</Group>

					<Group title='Выделение фоном'>
						<div className='flex flex-wrap gap-1.5'>
							{HIGHLIGHTS.map(item => (
								<Swatch
									key={item.code}
									annotation={item}
									active={isApplied(editor, item)}
									onClick={() => choose(item)}
								/>
							))}
						</div>
					</Group>

					<Group title='Члены предложения'>
						<div className='grid grid-cols-2 gap-1 sm:grid-cols-3'>
							{SYNTAX_ROLES.map(item => (
								<Chip
									key={item.code}
									active={isApplied(editor, item)}
									onClick={() => choose(item)}
								>
									<span
										className='annot annot-syntax'
										data-annot={item.code}
									>
										{item.label}
									</span>
								</Chip>
							))}
						</div>
					</Group>

					<Group title='Части речи'>
						<div className='grid grid-cols-2 gap-1 sm:grid-cols-3'>
							{PARTS_OF_SPEECH.map(item => (
								<Chip
									key={item.code}
									active={isApplied(editor, item)}
									onClick={() => choose(item)}
									title={item.label}
								>
									<span className='font-mono text-xs text-[rgb(var(--annot))]'>{item.code}</span>
									<span className='ml-1.5 truncate text-xs text-muted'>{item.label.toLowerCase()}</span>
								</Chip>
							))}
						</div>
					</Group>

					<Group title='Состав слова'>
						<div className='grid grid-cols-2 gap-1 sm:grid-cols-3'>
							{MORPHEMES.map(item => (
								<Chip
									key={item.code}
									active={isApplied(editor, item)}
									onClick={() => choose(item)}
								>
									<span
										className='annot annot-morpheme mr-2 mt-1 text-sm'
										data-annot={item.code}
									>
										{item.code === 'оконч' ? 'ть' : 'ход'}
									</span>
									<span className='text-xs text-muted'>{item.label}</span>
								</Chip>
							))}
						</div>
					</Group>

					<button
						type='button'
						onClick={() => {
							clearAll(editor)
							setOpen(false)
						}}
						className='mt-1 flex h-9 w-full items-center justify-center gap-2 border border-border text-sm text-muted transition-colors hover:bg-white/[0.05] hover:text-fg'
					>
						<Eraser size={14} />
						Снять оформление
					</button>
				</div>
			)}
		</div>
	)
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className='mb-3 border-b border-border pb-3 last:border-b-0'>
			<p className='eyebrow mb-2'>{title}</p>
			{children}
		</section>
	)
}

function Swatch({
	annotation,
	active,
	onClick
}: {
	annotation: IAnnotation
	active: boolean
	onClick: () => void
}) {
	return (
		<button
			type='button'
			title={annotation.label}
			aria-label={annotation.label}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				'grid h-7 w-7 place-items-center border transition-transform active:scale-90',
				active ? 'border-fg' : 'border-transparent hover:border-white/30'
			)}
		>
			{annotation.group === 'color' ? (
				<span
					className='text-sm font-semibold'
					style={{ color: annotation.color }}
				>
					А
				</span>
			) : (
				<span
					className='h-5 w-5'
					style={{ background: annotation.color }}
				/>
			)}
		</button>
	)
}

function Chip({
	active,
	onClick,
	title,
	children
}: {
	active: boolean
	onClick: () => void
	title?: string
	children: React.ReactNode
}) {
	return (
		<button
			type='button'
			title={title}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				'flex h-10 min-w-0 items-center px-2.5 text-left text-sm transition-colors',
				active ? 'bg-primary/15 text-fg' : 'bg-white/[0.03] text-fg hover:bg-white/[0.07]'
			)}
		>
			{children}
		</button>
	)
}
