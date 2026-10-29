'use client'

import cn from 'clsx'
import { Check, FileText, Image as ImageIcon, Mic, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { uploadStore } from '@/lib/upload-manager'

const ICONS = { image: ImageIcon, file: FileText, audio: Mic }

/** Аккуратный прогресс фоновых загрузок — внизу справа, на телефоне над нижней панелью */
export function UploadProgress() {
	const uploads = useSyncExternalStore(
		uploadStore.subscribe,
		uploadStore.getSnapshot,
		uploadStore.getServerSnapshot
	)
	if (!uploads.length) return null

	return (
		<div
			aria-live='polite'
			className='fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-[90] w-[min(20rem,calc(100vw-1.5rem))] space-y-1.5 lg:bottom-5 lg:right-5'
		>
			{uploads.map(upload => {
				const Icon = ICONS[upload.kind]
				return (
					<div
						key={upload.id}
						className='animate-pop-in border border-border bg-elevated/95 px-3 py-2.5 shadow-pop backdrop-blur'
					>
						<div className='flex items-center gap-2.5'>
							<Icon
								size={14}
								className='shrink-0 text-subtle'
							/>
							<span className='min-w-0 flex-1 truncate text-xs text-fg'>{upload.name}</span>
							<span
								className={cn(
									'flex shrink-0 items-center gap-1 font-mono text-2xs tabular-nums',
									upload.status === 'error'
										? 'text-danger'
										: upload.status === 'done'
											? 'text-success'
											: 'text-subtle'
								)}
							>
								{upload.status === 'done' ? (
									<Check size={12} />
								) : upload.status === 'error' ? (
									<X size={12} />
								) : (
									`${Math.round(upload.progress * 100)}%`
								)}
							</span>
						</div>
						<div className='mt-2 h-0.5 bg-white/10'>
							<div
								className={cn(
									'h-full transition-[width] duration-300',
									upload.status === 'error' ? 'bg-danger' : 'bg-primary'
								)}
								style={{ width: `${Math.max(3, upload.progress * 100)}%` }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}
