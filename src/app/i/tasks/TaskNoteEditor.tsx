'use client'

import { FileText, Pencil, X } from 'lucide-react'
import { type ChangeEvent, useState } from 'react'
import { createPortal } from 'react-dom'

interface TaskNoteEditorProps {
	value?: string
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void
}

export function TaskNoteEditor({ value = '', onChange }: TaskNoteEditorProps) {
	const [isOpen, setIsOpen] = useState(false)
	const preview = value.trim().replace(/\s+/g, ' ')

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='group flex min-w-0 max-w-full items-center gap-2 rounded-md py-1 text-left text-xs text-white/45 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
				aria-label={preview ? 'Открыть заметку к задаче' : 'Добавить заметку к задаче'}
			>
				<FileText size={14} className='shrink-0 text-white/35 group-hover:text-primary' />
				<span className='min-w-0 truncate'>
					{preview ? preview : 'Добавить заметку'}
				</span>
				<Pencil size={12} className='shrink-0 opacity-0 transition-opacity group-hover:opacity-70' />
			</button>

			{isOpen && typeof document !== 'undefined' && createPortal(
				<div
					className='fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]'
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
						className='flex max-h-[min(78vh,620px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#171819] shadow-2xl shadow-black/50'
					>
						<header className='flex items-center justify-between border-b border-white/[0.07] px-5 py-4'>
							<div>
								<h2 id='task-note-title' className='text-sm font-semibold text-white/90'>Заметка к задаче</h2>
								<p className='mt-0.5 text-xs text-white/40'>Изменения сохраняются автоматически</p>
							</div>
							<button
								type='button'
								onClick={() => setIsOpen(false)}
								className='rounded-lg p-2 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white'
								aria-label='Закрыть редактор заметки'
							>
								<X size={18} />
							</button>
						</header>
						<textarea
							autoFocus
							value={value}
							onChange={onChange}
							placeholder='Добавьте детали, ссылки или следующий шаг…'
							className='min-h-[220px] w-full flex-1 resize-y bg-transparent px-5 py-4 text-sm leading-6 text-white/85 placeholder:text-white/30 focus:outline-none'
						/>
						<footer className='border-t border-white/[0.07] px-5 py-3 text-right text-[11px] text-white/35'>
							{value.length} символов
						</footer>
					</section>
				</div>,
				document.body
			)}
		</>
	)
}
