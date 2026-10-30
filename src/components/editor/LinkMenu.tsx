'use client'

import type { Editor } from '@tiptap/react'
import { Copy, Eye, EyeOff, ExternalLink, Pencil } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { type ILinkMenuRequest, NO_PREVIEW } from './link-previews'

/** Меню по правому клику (долгому нажатию) на ссылке: предпросмотр, открыть, скопировать */
export function LinkMenu({
	editor,
	request,
	onClose,
	onEdit
}: {
	editor: Editor
	request: ILinkMenuRequest
	onClose: () => void
	onEdit?: () => void
}) {
	useEffect(() => {
		const close = (event: Event) => {
			if (event instanceof KeyboardEvent && event.key !== 'Escape') return
			if (event.type === 'pointerdown' && (event.target as HTMLElement).closest('[data-link-menu]')) return
			onClose()
		}
		document.addEventListener('pointerdown', close)
		document.addEventListener('keydown', close)
		window.addEventListener('scroll', onClose, true)
		window.addEventListener('resize', onClose)
		return () => {
			document.removeEventListener('pointerdown', close)
			document.removeEventListener('keydown', close)
			window.removeEventListener('scroll', onClose, true)
			window.removeEventListener('resize', onClose)
		}
	}, [onClose])

	const setPreview = (enabled: boolean) => {
		editor
			.chain()
			.setTextSelection(request.pos)
			.extendMarkRange('link')
			.updateAttributes('link', { title: enabled ? null : NO_PREVIEW })
			.setTextSelection(request.pos)
			.run()
		onClose()
	}

	const items = [
		request.hasPreview
			? { icon: EyeOff, label: 'Без предпросмотра', action: () => setPreview(false) }
			: { icon: Eye, label: 'Показывать предпросмотр', action: () => setPreview(true) },
		{
			icon: ExternalLink,
			label: 'Открыть в новой вкладке',
			action: () => {
				window.open(request.href, '_blank', 'noopener,noreferrer')
				onClose()
			}
		},
		{
			icon: Copy,
			label: 'Копировать ссылку',
			action: async () => {
				onClose()
				try {
					await navigator.clipboard.writeText(request.href)
					toast.success('Ссылка скопирована')
				} catch {
					toast.error('Не получилось скопировать')
				}
			}
		},
		...(onEdit && editor.isEditable
			? [
					{
						icon: Pencil,
						label: 'Изменить адрес',
						action: () => {
							editor.chain().setTextSelection(request.pos).extendMarkRange('link').run()
							onClose()
							onEdit()
						}
					}
				]
			: [])
	]

	const left = Math.min(request.x, window.innerWidth - 248)
	const top = Math.min(request.y, window.innerHeight - items.length * 40 - 56)

	return createPortal(
		<div
			data-link-menu
			role='menu'
			className='fixed z-[150] w-60 animate-pop-in border border-border bg-elevated p-1 shadow-pop'
			style={{ left: Math.max(8, left), top: Math.max(8, top) }}
		>
			<p className='truncate px-2.5 pb-1 pt-1.5 font-mono text-2xs text-subtle'>{request.href}</p>
			{items.map(({ icon: Icon, label, action }) => (
				<button
					key={label}
					type='button'
					role='menuitem'
					onClick={action}
					className='flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-sm text-fg transition-colors hover:bg-white/[0.06]'
				>
					<Icon
						size={15}
						className='shrink-0 text-subtle'
					/>
					{label}
				</button>
			))}
		</div>,
		document.body
	)
}
