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
			className='fixed inset-0 z-[110] flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
			onMouseDown={event => {
				if (event.target === event.currentTarget && !isPending) onClose()
			}}
		>
			<section
				role='alertdialog'
				aria-modal='true'
				aria-labelledby={`${dialogId}-title`}
				aria-describedby={`${dialogId}-description`}
				className='w-full max-w-sm animate-pop-in rounded-2xl border border-border bg-elevated p-5 shadow-pop'
			>
				<div className='flex items-start gap-3'>
					<span className='grid h-9 w-9 shrink-0 place-items-center bg-danger/10 text-danger'>
						<AlertTriangle size={17} />
					</span>
					<div className='min-w-0 flex-1'>
						<h2
							id={`${dialogId}-title`}
							className='pt-1.5 text-base font-semibold text-fg'
						>
							{title}
						</h2>
						<p
							id={`${dialogId}-description`}
							className='mt-1.5 text-sm text-muted'
						>
							{description}
						</p>
					</div>
					<button
						type='button'
						aria-label='Закрыть окно подтверждения'
						disabled={isPending}
						onClick={onClose}
						className='-mr-1.5 -mt-1.5 rounded-md p-1.5 text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg disabled:opacity-40'
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
						className='h-9 rounded-lg border border-border px-3.5 text-sm font-medium text-muted transition-colors hover:bg-white/[0.05] hover:text-fg disabled:opacity-40'
					>
						Отмена
					</button>
					<button
						type='button'
						disabled={isPending}
						onClick={onConfirm}
						className='h-9 rounded-lg bg-danger px-3.5 text-sm font-medium text-white transition-colors hover:bg-danger/85 disabled:opacity-40'
					>
						{isPending ? 'Выполняется…' : confirmLabel}
					</button>
				</div>
			</section>
		</div>,
		document.body
	)
}
