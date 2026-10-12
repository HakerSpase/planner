'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
	open: boolean
	title: string
	description: string
	confirmLabel?: string
	isPending?: boolean
	onConfirm: () => void
	onClose: () => void
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = 'Удалить',
	isPending = false,
	onConfirm,
	onClose
}: ConfirmDialogProps) {
	const dialogId = useId()
	useEffect(() => {
		if (!open) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !isPending) onClose()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [isPending, onClose, open])

	if (!open || typeof document === 'undefined') return null

	return createPortal(
		<div
			className='fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4'
			onMouseDown={event => {
				if (event.target === event.currentTarget && !isPending) onClose()
			}}
		>
			<section
				role='alertdialog'
				aria-modal='true'
				aria-labelledby={`${dialogId}-title`}
				aria-describedby={`${dialogId}-description`}
				className='w-full max-w-sm border border-white/10 bg-[#151617] p-4 shadow-2xl shadow-black/40 sm:p-5'
			>
				<div className='flex items-start gap-3'>
					<AlertTriangle
						className='mt-0.5 shrink-0 text-amber-300'
						size={19}
					/>
					<div className='min-w-0 flex-1'>
						<h2
							id={`${dialogId}-title`}
							className='text-base font-semibold text-white/90'
						>
							{title}
						</h2>
						<p
							id={`${dialogId}-description`}
							className='mt-2 text-sm leading-5 text-white/55'
						>
							{description}
						</p>
					</div>
					<button
						type='button'
						aria-label='Закрыть окно подтверждения'
						disabled={isPending}
						onClick={onClose}
						className='-mr-1 -mt-1 p-1 text-white/40 hover:text-white disabled:opacity-40'
					>
						<X size={17} />
					</button>
				</div>
				<div className='mt-5 flex justify-end gap-2'>
					<button
						type='button'
						autoFocus
						disabled={isPending}
						onClick={onClose}
						className='border border-white/10 px-3 py-2 text-sm text-white/65 hover:bg-white/[0.04] disabled:opacity-40'
					>
						Отмена
					</button>
					<button
						type='button'
						disabled={isPending}
						onClick={onConfirm}
						className='border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-40'
					>
						{isPending ? 'Выполняется…' : confirmLabel}
					</button>
				</div>
			</section>
		</div>,
		document.body
	)
}
