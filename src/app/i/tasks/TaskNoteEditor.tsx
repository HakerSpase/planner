'use client'

import { FileText, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface TaskNoteEditorProps {
	value?: string
	onChange: (value: string) => void
}

export function TaskNoteEditor({ value = '', onChange }: TaskNoteEditorProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
	const preview = value.trim().replace(/\s+/g, ' ')

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='group flex min-h-10 w-full min-w-0 max-w-full items-center gap-2 py-1 text-left text-xs text-white/55 transition-colors hover:text-white/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60'
				aria-label={
					preview ? 'Открыть заметку к задаче' : 'Добавить заметку к задаче'
				}
			>
				<FileText
					size={14}
					className='shrink-0 text-white/35 group-hover:text-primary'
				/>
				<span className='min-w-0 flex-1 break-words [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'>
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
						className='fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 sm:p-4'
						onMouseDown={event => {
							if (event.target === event.currentTarget) setIsOpen(false)
						}}
						onKeyDown={event => {
							if (event.key === 'Escape') setIsOpen(false)
						}}
					>
						<section
							role='dialog'
							aria-modal='true'
							aria-labelledby='task-note-title'
							className='flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden border border-white/10 bg-[#171819] shadow-2xl shadow-black/50'
						>
							<header className='flex items-center justify-between border-b border-white/[0.07] px-4 py-3 sm:px-5 sm:py-4'>
								<div>
									<h2
										id='task-note-title'
										className='text-sm font-semibold text-white/90'
									>
										Заметка к задаче
									</h2>
									<p className='mt-0.5 text-xs text-white/40'>
										Изменения сохраняются автоматически
									</p>
								</div>
								<button
									type='button'
									onClick={() => setIsOpen(false)}
									className='grid h-11 w-11 shrink-0 place-items-center text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white'
									aria-label='Закрыть редактор заметки'
								>
									<X size={18} />
								</button>
							</header>
							<textarea
								autoFocus
								value={value}
								onChange={event => onChange(event.currentTarget.value)}
								placeholder='Добавьте детали, ссылки или следующий шаг…'
								className='min-h-[45dvh] w-full flex-1 resize-y bg-transparent px-4 py-3 text-sm leading-6 text-white/85 placeholder:text-white/30 focus:outline-none sm:min-h-[260px] sm:px-5 sm:py-4'
							/>
							<footer className='flex items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3 sm:px-5'>
								{value && (
									<button
										type='button'
										onClick={() => setIsClearConfirmOpen(true)}
										className='text-xs text-white/40 hover:text-white/80'
									>
										Очистить заметку
									</button>
								)}
								<span className='ml-auto text-[11px] text-white/35'>
									{value.length} символов
								</span>
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
						onChange('')
						setIsClearConfirmOpen(false)
					}}
					onClose={() => setIsClearConfirmOpen(false)}
				/>
			)}
		</>
	)
}
