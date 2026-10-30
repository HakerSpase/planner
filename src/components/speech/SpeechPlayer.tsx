'use client'

import cn from 'clsx'
import { AudioLines, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { setPreferences, usePreferences } from '@/lib/preferences'
import {
	isSpeechSupported,
	pauseSpeech,
	restartCurrent,
	resumeSpeech,
	seekSpeech,
	selectedSpeechText,
	speak,
	stopSpeech,
	useSpeech
} from '@/lib/speech'

const RATES = [0.8, 1, 1.25, 1.5, 1.75, 2]

/** Плеер озвучки: плашка внизу экрана, пока что-то читается */
export function SpeechPlayer() {
	const speech = useSpeech()
	const [preferences] = usePreferences()

	// Пробел — пауза, Esc — стоп (когда фокус не в поле ввода)
	useEffect(() => {
		if (speech.status === 'idle') return
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement
			if (target.closest('input, textarea, [contenteditable="true"]')) return
			if (event.key === 'Escape') stopSpeech()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [speech.status])

	// Уходим со страницы — замолкаем
	useEffect(() => () => stopSpeech(), [])

	if (speech.status === 'idle') return <SpeakSelectionButton />

	const progress = speech.total ? ((speech.index + 1) / speech.total) * 100 : 0
	const playing = speech.status === 'playing'

	return (
		<div className='pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 lg:bottom-6 print:hidden'>
			<div
				role='region'
				aria-label='Озвучка'
				className='pointer-events-auto relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-white/10 bg-elevated/95 shadow-pop backdrop-blur-xl'
			>
				<div className='flex items-center gap-2 py-2 pl-3 pr-2'>
					<span
						className={cn(
							'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary',
							playing && 'animate-pulse'
						)}
					>
						<AudioLines size={17} />
					</span>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-xs text-subtle'>
							{speech.title || 'Озвучка'} · {speech.index + 1} из {speech.total}
						</p>
						<p className='truncate text-sm text-fg'>{speech.current}</p>
					</div>
					<button
						type='button'
						aria-label='Предыдущая фраза'
						onClick={() => seekSpeech(-1)}
						className='hidden h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-fg sm:grid'
					>
						<SkipBack size={16} />
					</button>
					<button
						type='button'
						aria-label={playing ? 'Пауза' : 'Продолжить'}
						onClick={() => (playing ? pauseSpeech() : resumeSpeech())}
						className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover'
					>
						{playing ? (
							<Pause
								size={17}
								fill='currentColor'
							/>
						) : (
							<Play
								size={17}
								fill='currentColor'
								className='translate-x-px'
							/>
						)}
					</button>
					<button
						type='button'
						aria-label='Следующая фраза'
						onClick={() => seekSpeech(1)}
						className='grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<SkipForward size={16} />
					</button>
					<button
						type='button'
						title='Скорость'
						onClick={() => {
							const index = RATES.indexOf(preferences.ttsRate)
							setPreferences({ ttsRate: RATES[(index + 1) % RATES.length] })
							restartCurrent()
						}}
						className='h-8 w-12 shrink-0 rounded-full border border-border font-mono text-xs text-muted transition-colors hover:text-fg'
					>
						{preferences.ttsRate}×
					</button>
					<button
						type='button'
						aria-label='Остановить'
						onClick={stopSpeech}
						className='grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<X size={16} />
					</button>
				</div>
				<div className='absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.06]'>
					<div
						className='h-full bg-primary transition-[width] duration-300'
						style={{ width: `${progress}%` }}
					/>
				</div>
			</div>
		</div>
	)
}

/**
 * Выделили текст в конспекте (в режиме чтения) — рядом появляется кнопка «Озвучить».
 * В режиме правки та же кнопка есть на панели выделения.
 */
function SpeakSelectionButton() {
	const [position, setPosition] = useState<{
		left: number
		top: number
	} | null>(null)

	useEffect(() => {
		if (!isSpeechSupported()) return
		let timer = 0
		const update = () => {
			window.clearTimeout(timer)
			timer = window.setTimeout(() => {
				const selection = window.getSelection()
				if (!selection || selection.isCollapsed || !selection.rangeCount)
					return setPosition(null)
				const range = selection.getRangeAt(0)
				const host =
					(
						range.commonAncestorContainer as HTMLElement
					).parentElement?.closest?.('.rich-editor-content') ??
					(range.commonAncestorContainer as HTMLElement).closest?.(
						'.rich-editor-content'
					)
				if (
					!host ||
					host.getAttribute('contenteditable') === 'true' ||
					selection.toString().trim().length < 2
				)
					return setPosition(null)
				const rect = range.getBoundingClientRect()
				setPosition({
					left: Math.min(
						window.innerWidth - 70,
						Math.max(70, rect.left + rect.width / 2)
					),
					top: Math.min(window.innerHeight - 56, rect.bottom + 10)
				})
			}, 180)
		}
		document.addEventListener('selectionchange', update)
		window.addEventListener('scroll', update, true)
		return () => {
			window.clearTimeout(timer)
			document.removeEventListener('selectionchange', update)
			window.removeEventListener('scroll', update, true)
		}
	}, [])

	if (!position) return null
	return (
		<button
			type='button'
			onMouseDown={event => event.preventDefault()}
			onClick={() => {
				const text = selectedSpeechText()
				setPosition(null)
				if (text) speak(text, 'Выделенный текст')
			}}
			style={{ left: position.left, top: position.top }}
			className='fixed z-[60] flex h-9 -translate-x-1/2 animate-pop-in items-center gap-2 rounded-full border border-white/10 bg-elevated/95 px-3.5 text-sm text-fg shadow-pop backdrop-blur-xl transition-colors hover:border-primary/50 print:hidden'
		>
			<AudioLines
				size={15}
				className='text-primary'
			/>
			Озвучить
		</button>
	)
}
