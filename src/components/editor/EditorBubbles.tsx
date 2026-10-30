'use client'

import { TextSelection } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { BubbleMenu, type Editor } from '@tiptap/react'
import cn from 'clsx'
import {
	AudioLines,
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	BetweenVerticalStart,
	Bold,
	ClipboardPaste,
	Combine,
	Copy,
	Eraser,
	Highlighter,
	Italic,
	PanelTop,
	Scissors,
	Split,
	Strikethrough,
	TextSelect,
	Trash2,
	Underline
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AnnotationMenu, apply, isApplied } from './AnnotationMenu'
import {
	ANNOTATION_MARKS,
	HIGHLIGHTS,
	SYNTAX_ROLES,
	TEXT_COLORS,
	resolveAnnotation
} from './annotations'
import { copyText, readText } from '@/lib/clipboard'
import { nativePlugin } from '@/lib/native'
import { isSpeechSupported, selectedSpeechText, speak } from '@/lib/speech'

/*
 * Плавающие панели редактора:
 *  — при выделении текста: жирный, курсив, цвет, фон, линии (подчеркивания любого цвета) и весь разбор;
 *  — курсор в таблице: строки и столбцы — добавить, удалить, объединить ячейки, шапка, удалить таблицу.
 */

const QUICK_COLORS = TEXT_COLORS.filter(item =>
	['red', 'orange', 'green', 'blue', 'purple'].includes(item.code)
)
const LINE_STYLES: Record<string, string> = {
	подл: 'Черта',
	сказ: 'Две черты',
	опр: 'Волна',
	доп: 'Пунктир',
	обст: 'Точка-тире'
}

function Button({
	label,
	active,
	onClick,
	children,
	danger
}: {
	label: string
	active?: boolean
	onClick: () => void
	children: ReactNode
	danger?: boolean
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			aria-pressed={active}
			onMouseDown={event => event.preventDefault()}
			onClick={onClick}
			className={cn(
				'grid h-8 min-w-8 shrink-0 place-items-center px-1.5 transition-colors',
				active
					? 'bg-white/[0.1] text-fg'
					: danger
						? 'text-subtle hover:bg-danger/10 hover:text-danger'
						: 'text-muted hover:bg-white/[0.06] hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

// На телефоне панель выделения в два ряда — там разделители не нужны
const Divider = () => (
	<span className='mx-0.5 h-5 w-px shrink-0 bg-border sm-max:hidden' />
)

export function SelectionBubble({ editor }: { editor: Editor }) {
	const [panel, setPanel] = useState<'line' | 'highlight' | null>(null)
	const [lineColor, setLineColor] = useState<string | null>(null)
	// На сенсорном экране системной плашки нет (в приложении) или она мешает — свои кнопки буфера
	const [touch, setTouch] = useState(false)
	useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), [])

	// Android-приложение: пока выделение в этой заметке, системную плашку прячем
	useEffect(() => {
		const ui = nativePlugin('PlannerUi')
		if (!ui) return
		let hidden = false
		const update = () => {
			const next =
				editor.isEditable && editor.isFocused && !editor.state.selection.empty
			if (next === hidden) return
			hidden = next
			ui.setSelectionMenu({ hidden }).catch(() => {})
		}
		editor.on('selectionUpdate', update)
		editor.on('focus', update)
		editor.on('blur', update)
		return () => {
			editor.off('selectionUpdate', update)
			editor.off('focus', update)
			editor.off('blur', update)
			if (hidden) ui.setSelectionMenu({ hidden: false }).catch(() => {})
		}
	}, [editor])

	const selectedText = () => {
		const { from, to } = editor.state.selection
		return editor.state.doc.textBetween(from, to, '\n')
	}
	const copy = async (cut: boolean) => {
		try {
			await copyText(selectedText())
			if (cut) editor.chain().focus().deleteSelection().run()
			else toast('Скопировано', { duration: 1200 })
		} catch {
			toast.error('Не удалось скопировать')
		}
	}
	const paste = async () => {
		try {
			const text = await readText()
			if (text) editor.chain().focus().insertContent(text).run()
		} catch {
			toast.error('Нет доступа к буферу обмена')
		}
	}

	return (
		<BubbleMenu
			editor={editor}
			pluginKey='selectionBubble'
			updateDelay={120}
			shouldShow={({ editor, state }) => {
				const { selection } = state
				const show =
					editor.isEditable &&
					selection instanceof TextSelection &&
					!selection.empty &&
					!editor.isActive('codeBlock') &&
					state.doc.textBetween(selection.from, selection.to).trim().length > 0
				if (!show && panel) setTimeout(() => setPanel(null))
				return show
			}}
			tippyOptions={{
				placement: 'bottom',
				maxWidth: 'none',
				offset: [0, 8],
				zIndex: 40
			}}
		>
			<div
				className='relative flex max-w-[calc(100vw-1rem)] items-center overflow-visible border border-border bg-elevated p-0.5 shadow-pop sm-max:w-[18.5rem] sm-max:flex-wrap sm-max:justify-center'
				onMouseDown={event => {
					if (!(event.target as HTMLElement).closest('input'))
						event.preventDefault()
				}}
			>
				{touch && (
					<>
						<Button
							label='Копировать'
							onClick={() => void copy(false)}
						>
							<Copy size={15} />
						</Button>
						<Button
							label='Вырезать'
							onClick={() => void copy(true)}
						>
							<Scissors size={15} />
						</Button>
						<Button
							label='Вставить'
							onClick={() => void paste()}
						>
							<ClipboardPaste size={15} />
						</Button>
						<Button
							label='Выделить всё'
							onClick={() => editor.chain().focus().selectAll().run()}
						>
							<TextSelect size={15} />
						</Button>
						<Divider />
					</>
				)}
				<Button
					label='Жирный'
					active={editor.isActive('bold')}
					onClick={() => editor.chain().focus().toggleBold().run()}
				>
					<Bold size={15} />
				</Button>
				<Button
					label='Курсив'
					active={editor.isActive('italic')}
					onClick={() => editor.chain().focus().toggleItalic().run()}
				>
					<Italic size={15} />
				</Button>
				<Button
					label='Зачёркнутый'
					active={editor.isActive('strike')}
					onClick={() => editor.chain().focus().toggleStrike().run()}
				>
					<Strikethrough size={15} />
				</Button>
				<Divider />
				{QUICK_COLORS.map(item => (
					<Button
						key={item.code}
						label={item.label}
						active={isApplied(editor, item)}
						onClick={() => apply(editor, item)}
					>
						<span
							className='text-[15px] font-semibold leading-none'
							style={{ color: item.color }}
						>
							А
						</span>
					</Button>
				))}
				<Divider />
				<Button
					label='Фон'
					active={
						panel === 'highlight' ||
						HIGHLIGHTS.some(item => isApplied(editor, item))
					}
					onClick={() =>
						setPanel(value => (value === 'highlight' ? null : 'highlight'))
					}
				>
					<Highlighter size={15} />
				</Button>
				<Button
					label='Подчеркнуть линией'
					active={
						panel === 'line' ||
						SYNTAX_ROLES.some(item => editor.isActive('syntaxRole'))
					}
					onClick={() => setPanel(value => (value === 'line' ? null : 'line'))}
				>
					<Underline size={15} />
				</Button>
				<AnnotationMenu
					editor={editor}
					panelClassName='right-0 top-full w-[min(25rem,calc(100vw-1rem))]'
				/>
				<Button
					label='Снять оформление'
					onClick={() =>
						editor
							.chain()
							.focus()
							.unsetAllMarks()
							.command(({ tr, state }) => {
								ANNOTATION_MARKS.forEach(mark =>
									tr.removeMark(
										state.selection.from,
										state.selection.to,
										state.schema.marks[mark.name]
									)
								)
								return true
							})
							.run()
					}
				>
					<Eraser size={14} />
				</Button>
				{isSpeechSupported() && (
					<Button
						label='Озвучить выделенное'
						onClick={() => {
							const text = selectedSpeechText()
							if (text) speak(text, 'Выделенный текст')
						}}
					>
						<AudioLines size={15} />
					</Button>
				)}

				{panel === 'highlight' && (
					<div className='absolute left-0 top-full z-30 mt-1 flex flex-wrap gap-1 border border-border bg-elevated p-2 shadow-pop'>
						{HIGHLIGHTS.map(item => (
							<button
								key={item.code}
								type='button'
								title={item.label}
								aria-label={item.label}
								onClick={() => {
									apply(editor, item)
									setPanel(null)
								}}
								className={cn(
									'grid h-8 w-8 place-items-center border',
									isApplied(editor, item)
										? 'border-fg'
										: 'border-transparent hover:border-white/30'
								)}
							>
								<span
									className='h-6 w-6'
									style={{ background: item.color }}
								/>
							</button>
						))}
					</div>
				)}

				{panel === 'line' && (
					<div className='absolute left-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-1rem))] border border-border bg-elevated p-2.5 shadow-pop'>
						<p className='eyebrow mb-1.5'>Цвет линии</p>
						<div className='mb-2.5 flex flex-wrap gap-1'>
							<button
								type='button'
								onClick={() => setLineColor(null)}
								className={cn(
									'h-7 border px-2 text-xs',
									!lineColor
										? 'border-fg text-fg'
										: 'border-border text-muted hover:text-fg'
								)}
							>
								Обычный
							</button>
							{TEXT_COLORS.map(item => (
								<button
									key={item.code}
									type='button'
									title={item.label}
									aria-label={item.label}
									onClick={() => setLineColor(item.code)}
									className={cn(
										'grid h-7 w-7 place-items-center border',
										lineColor === item.code
											? 'border-fg'
											: 'border-transparent hover:border-white/30'
									)}
								>
									<span
										className='h-1 w-4'
										style={{ background: item.color }}
									/>
								</button>
							))}
						</div>
						<p className='eyebrow mb-1.5'>Вид</p>
						<div className='grid grid-cols-3 gap-1'>
							{SYNTAX_ROLES.map(item => {
								const annotation =
									(lineColor &&
										resolveAnnotation(`${item.code}:${lineColor}`)) ||
									item
								return (
									<button
										key={item.code}
										type='button'
										title={item.label}
										onClick={() => {
											apply(editor, annotation)
											setPanel(null)
										}}
										className='flex h-10 items-center justify-center whitespace-nowrap bg-white/[0.03] px-1.5 text-[13px] text-fg hover:bg-white/[0.07]'
									>
										<span
											className='annot annot-syntax'
											data-annot={item.code}
											style={
												lineColor
													? ({
															'--annot-line': TEXT_COLORS.find(
																color => color.code === lineColor
															)!.color
														} as React.CSSProperties)
													: undefined
											}
										>
											{LINE_STYLES[item.code]}
										</span>
									</button>
								)
							})}
						</div>
					</div>
				)}
			</div>
		</BubbleMenu>
	)
}

/** Таблица под курсором — её DOM, чтобы панель стояла над таблицей */
function tableRect(editor: Editor) {
	const { view, state } = editor
	try {
		const { node } = view.domAtPos(state.selection.from)
		const element = (
			node.nodeType === 3 ? node.parentElement : (node as HTMLElement)
		)?.closest('table')
		if (element) return element.getBoundingClientRect()
	} catch {
		// позиция вне документа
	}
	return new DOMRect()
}

export function TableBubble({ editor }: { editor: Editor }) {
	const run = (
		command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>
	) => command(editor.chain().focus()).run()
	const cellSelected = editor.state.selection instanceof CellSelection

	return (
		<BubbleMenu
			editor={editor}
			pluginKey='tableBubble'
			updateDelay={80}
			shouldShow={({ editor }) => editor.isEditable && editor.isActive('table')}
			tippyOptions={{
				placement: 'top-start',
				maxWidth: 'none',
				offset: [0, 6],
				zIndex: 35,
				getReferenceClientRect: () => tableRect(editor)
			}}
		>
			<div className='flex max-w-[calc(100vw-1rem)] items-center overflow-x-auto border border-border bg-elevated p-0.5 shadow-pop [scrollbar-width:none]'>
				<span className='px-2 text-2xs uppercase tracking-wider text-subtle'>
					Строка
				</span>
				<Button
					label='Строка выше'
					onClick={() => run(chain => chain.addRowBefore())}
				>
					<BetweenHorizontalStart size={15} />
				</Button>
				<Button
					label='Строка ниже'
					onClick={() => run(chain => chain.addRowAfter())}
				>
					<BetweenHorizontalEnd size={15} />
				</Button>
				<Button
					label='Удалить строку'
					danger
					onClick={() => run(chain => chain.deleteRow())}
				>
					<Trash2 size={14} />
				</Button>
				<Divider />
				<span className='px-2 text-2xs uppercase tracking-wider text-subtle'>
					Столбец
				</span>
				<Button
					label='Столбец слева'
					onClick={() => run(chain => chain.addColumnBefore())}
				>
					<BetweenVerticalStart size={15} />
				</Button>
				<Button
					label='Столбец справа'
					onClick={() => run(chain => chain.addColumnAfter())}
				>
					<BetweenVerticalEnd size={15} />
				</Button>
				<Button
					label='Удалить столбец'
					danger
					onClick={() => run(chain => chain.deleteColumn())}
				>
					<Trash2 size={14} />
				</Button>
				<Divider />
				<Button
					label={cellSelected ? 'Объединить ячейки' : 'Разделить ячейку'}
					onClick={() =>
						run(chain =>
							cellSelected ? chain.mergeCells() : chain.splitCell()
						)
					}
				>
					{cellSelected ? <Combine size={15} /> : <Split size={15} />}
				</Button>
				<Button
					label='Шапка таблицы вкл/выкл'
					active={editor.isActive('tableHeader')}
					onClick={() => run(chain => chain.toggleHeaderRow())}
				>
					<PanelTop size={15} />
				</Button>
				<Divider />
				<Button
					label='Удалить таблицу'
					danger
					onClick={() => run(chain => chain.deleteTable())}
				>
					<span className='flex items-center gap-1 text-xs'>
						<Trash2 size={14} />
						Таблица
					</span>
				</Button>
			</div>
		</BubbleMenu>
	)
}
