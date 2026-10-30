'use client'

import cn from 'clsx'
import { AudioLines, Pause, Play, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Waveform } from '@/components/editor/voice'

import { setPreferences, usePreferences } from '@/lib/preferences'
import {
	getSpeechChunks,
	isSpeechSupported,
	pauseSpeech,
	restartCurrent,
	resumeSpeech,
	seekSpeechTo,
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

	return (
		<ActivePlayer
			title={speech.title}
			index={speech.index}
			total={speech.total}
			current={speech.current}
			playing={speech.status === 'playing'}
			rate={preferences.ttsRate}
		/>
	)
}

// Псевдоволна по тексту: стабильная для одной и той же фразы, похожа на речь
function textPeaks(chunks: string[], bars = 64) {
	const lengths = chunks.map(chunk => Math.max(1, chunk.length))
	const total = lengths.reduce((sum, value) => sum + value, 0)
	const starts: number[] = []
	lengths.reduce((sum, value, i) => ((starts[i] = sum), sum + value), 0)
	return Array.from({ length: bars }, (_, j) => {
		const position = ((j + 0.5) / bars) * total
		let index = starts.findIndex((start, i) => position < start + lengths[i])
		if (index < 0) index = chunks.length - 1
		const offset = Math.floor(position - starts[index])
		const code = chunks[index].charCodeAt(offset % chunks[index].length) || 0
		const wave = Math.abs(Math.sin(j * 1.7 + code * 0.31)) * 0.6 + 0.35
		// паузы между фразами — пониже
		const edge = offset < 2 || lengths[index] - offset < 2 ? 0.45 : 1
		return Math.min(1, wave * edge)
	})
}

/** Плеер как голосовое в Telegram: круглая кнопка, волна с перемоткой, время, скорость */
function ActivePlayer({
	title,
	index,
	total,
	current,
	playing,
	rate
}: {
	title: string
	index: number
	total: number
	current: string
	playing: boolean
	rate: number
}) {
	const chunks = getSpeechChunks()
	const lengths = chunks.map(chunk => Math.max(1, chunk.length))
	const totalChars = lengths.reduce((sum, value) => sum + value, 0) || 1
	const before = lengths.slice(0, index).reduce((sum, value) => sum + value, 0)
	// ~14 символов в секунду при скорости 1× — чтобы шкала шла плавно внутри фразы
	const charsPerSecond = 14 * rate
	const [phraseStart, setPhraseStart] = useState(Date.now())
	const [, setTick] = useState(0)
	useEffect(() => setPhraseStart(Date.now()), [index, playing])
	useEffect(() => {
		if (!playing) return
		const timer = setInterval(() => setTick(tick => tick + 1), 120)
		return () => clearInterval(timer)
	}, [playing])
	const inside = playing
		? Math.min(
				lengths[index] ?? 0,
				((Date.now() - phraseStart) / 1000) * charsPerSecond
			)
		: 0
	const progress = Math.min(1, (before + inside) / totalChars)
	const peaks = useMemo(() => textPeaks(chunks), [chunks])

	const elapsed = (before + inside) / charsPerSecond
	const length = totalChars / charsPerSecond
	const clock = (seconds: number) =>
		`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

	const seek = (fraction: number) => {
		const target = fraction * totalChars
		let sum = 0
		for (let i = 0; i < lengths.length; i++) {
			if (target < sum + lengths[i]) return seekSpeechTo(i)
			sum += lengths[i]
		}
		seekSpeechTo(lengths.length - 1)
	}

	return (
		<div className='pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-3 lg:bottom-6 print:hidden'>
			<div
				role='region'
				aria-label='Озвучка'
				className='pointer-events-auto flex w-full max-w-xl animate-pop-in items-center gap-3 rounded-2xl border border-white/10 bg-elevated/95 py-2.5 pl-2.5 pr-2 shadow-pop backdrop-blur-xl'
			>
				<button
					type='button'
					aria-label={playing ? 'Пауза' : 'Продолжить'}
					onClick={() => (playing ? pauseSpeech() : resumeSpeech())}
					className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95'
				>
					{playing ? (
						<Pause
							size={18}
							fill='currentColor'
						/>
					) : (
						<Play
							size={18}
							fill='currentColor'
							className='translate-x-px'
						/>
					)}
				</button>
				<div className='min-w-0 flex-1'>
					<p
						className='truncate text-xs text-subtle'
						title={current}
					>
						{title || 'Озвучка'}
					</p>
					<Waveform
						peaks={peaks}
						progress={progress}
						onSeek={seek}
					/>
					<p className='flex items-center gap-2 font-mono text-2xs tabular-nums text-subtle'>
						<span>
							{clock(elapsed)} / {clock(length)}
						</span>
						<span className='truncate font-sans'>
							фраза {index + 1} из {total}
						</span>
					</p>
				</div>
				<button
					type='button'
					title='Скорость'
					onClick={() => {
						const position = RATES.indexOf(rate)
						setPreferences({ ttsRate: RATES[(position + 1) % RATES.length] })
						restartCurrent()
					}}
					className='h-7 shrink-0 rounded-full bg-white/[0.08] px-2.5 font-mono text-xs text-fg transition-colors hover:bg-white/[0.14]'
				>
					{rate}×
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
