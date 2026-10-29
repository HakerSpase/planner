'use client'

import { Check, FileText, Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface TaskNoteEditorProps {
	value?: string
	onChange: (value: string) => void
}

export function TaskNoteEditor({ value = '', onChange }: TaskNoteEditorProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [draft, setDraft] = useState(value)
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
	const overlayPointerDownRef = useRef(false)
	const preview = value.trim().replace(/\s+/g, ' ')

	useEffect(() => {
		setDraft(value || '')
	}, [value])

	const handleTextChange = (text: string) => {
		setDraft(text)
		onChange(text)
	}

	const close = () => {
		onChange(draft)
		setIsOpen(false)
	}

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='group flex min-h-8 w-full min-w-0 max-w-full items-center gap-2 rounded-md py-1 text-left text-xs text-subtle transition-colors hover:text-fg'
				aria-label={
					preview ? 'Открыть заметку к задаче' : 'Добавить заметку к задаче'
				}
			>
				<FileText
					size={14}
					className='shrink-0 text-subtle group-hover:text-primary'
				/>
				<span className='min-w-0 flex-1 break-words whitespace-normal [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'>
					{preview ? preview : 'Добавить заметку'}
				</span>
				<Pencil
					size={12}
					className='shrink-0 opacity-0 transition-opacity group-hover:opacity-70'
				/>
			</button>

			{isOpen &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						className='fixed inset-0 z-[100] flex animate-fade-in items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4'
						onPointerDown={event => {
							overlayPointerDownRef.current =
								event.target === event.currentTarget
						}}
						onClick={event => {
							if (
								overlayPointerDownRef.current &&
								event.target === event.currentTarget
							) {
								close()
							}
							overlayPointerDownRef.current = false
						}}
						onKeyDown={event => {
							if (event.key === 'Escape') close()
						}}
					>
						<section
							role='dialog'
							aria-modal='true'
							aria-labelledby='task-note-title'
							className='flex max-h-[88dvh] w-full max-w-xl animate-pop-in flex-col overflow-hidden rounded-2xl border border-border bg-elevated shadow-pop'
						>
							<header className='flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 sm:py-4'>
								<div>
									<h2
										id='task-note-title'
										className='text-sm font-semibold text-fg'
									>
										Заметка к задаче
									</h2>
									<p className='mt-0.5 text-xs text-subtle'>
										Изменения сохраняются автоматически
									</p>
								</div>
								<button
									type='button'
									onClick={close}
									className='inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-hover'
								>
									<Check size={14} />
									<span>Готово</span>
								</button>
							</header>

							<textarea
								autoFocus
								value={draft}
								onChange={event => handleTextChange(event.currentTarget.value)}
								placeholder='Добавьте детали, ссылки или следующий шаг…'
								className='min-h-[160px] max-h-[50dvh] w-full flex-1 resize-y bg-transparent px-4 py-3 text-base leading-6 text-fg placeholder:text-subtle focus:outline-none sm:min-h-[260px] sm:px-5 sm:py-4 sm:text-sm'
							/>

							<footer className='flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5'>
								{draft ? (
									<button
										type='button'
										onClick={() => setIsClearConfirmOpen(true)}
										className='text-xs text-subtle transition-colors hover:text-danger'
									>
										Очистить заметку
									</button>
								) : (
									<span />
								)}
								<div className='flex items-center gap-3'>
									<span className='text-[11px] text-subtle'>
										{draft.length.toLocaleString('ru-RU')} символов
									</span>
								</div>
							</footer>
						</section>
					</div>,
					document.body
				)}

			{isClearConfirmOpen && (
				<ConfirmDialog
					open={isClearConfirmOpen}
					title='Очистить заметку?'
					description='Текст заметки будет удалён.'
					confirmLabel='Очистить'
					onConfirm={() => {
						handleTextChange('')
						setIsClearConfirmOpen(false)
					}}
					onClose={() => setIsClearConfirmOpen(false)}
				/>
			)}
		</>
	)
}
