'use client'

import cn from 'clsx'
import { ArrowUp, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/*
 * Голосовые как в Telegram: волна громкости вместо полоски прогресса
 * и панель записи с живой волной.
 */

const PEAKS = 64
const WAVE_KEY = 'planner:wave:'

// Волну храним коротко: 64 значения 0…35 одним словом в base36
const pack = (peaks: number[]) =>
	peaks.map(value => Math.round(value * 35).toString(36)).join('')
const unpack = (text: string) =>
	Array.from(text, char => parseInt(char, 36) / 35)

function readCache(src: string) {
	try {
		const value = localStorage.getItem(WAVE_KEY + src)
		return value && value.length === PEAKS ? unpack(value) : null
	} catch {
		return null
	}
}

const memory = new Map<string, number[]>()

/** Громкость по 64 отрезкам записи, 0…1 — считается один раз и запоминается */
async function computePeaks(src: string) {
	const response = await fetch(src)
	const buffer = await response.arrayBuffer()
	const context = new AudioContext()
	try {
		const audio = await context.decodeAudioData(buffer)
		const data = audio.getChannelData(0)
		const step = Math.max(1, Math.floor(data.length / PEAKS))
		const raw: number[] = []
		for (let i = 0; i < PEAKS; i++) {
			let sum = 0
			const from = i * step
			const to = Math.min(data.length, from + step)
			for (let j = from; j < to; j++) sum += data[j] * data[j]
			raw.push(Math.sqrt(sum / Math.max(1, to - from)))
		}
		const max = Math.max(...raw, 0.0001)
		return raw.map(value => Math.max(0.08, Math.min(1, value / max)))
	} finally {
		context.close().catch(() => {})
	}
}

export function useWaveform(src: string | null) {
	const [peaks, setPeaks] = useState<number[] | null>(() =>
		src ? (memory.get(src) ?? null) : null
	)
	useEffect(() => {
		if (!src) return
		const cached = memory.get(src) ?? readCache(src)
		if (cached) {
			memory.set(src, cached)
			setPeaks(cached)
			return
		}
		let alive = true
		computePeaks(src)
			.then(result => {
				memory.set(src, result)
				if (!src.startsWith('blob:'))
					try {
						localStorage.setItem(WAVE_KEY + src, pack(result))
					} catch {}
				if (alive) setPeaks(result)
			})
			.catch(() => {})
		return () => {
			alive = false
		}
	}, [src])
	return peaks
}

/** Сколько полосок влезает по ширине: полоска 3px + промежуток 2px */
function useBarCount(ref: React.RefObject<HTMLElement>, fallback = 40) {
	const [count, setCount] = useState(fallback)
	useLayoutEffect(() => {
		const element = ref.current
		if (!element) return
		const update = () =>
			setCount(Math.max(12, Math.floor((element.clientWidth + 2) / 5)))
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		return () => observer.disconnect()
	}, [ref])
	return count
}

function resample(peaks: number[], count: number) {
	return Array.from({ length: count }, (_, i) => {
		const from = Math.floor((i / count) * peaks.length)
		const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length))
		return Math.max(...peaks.slice(from, to))
	})
}

/** Волна голосового: прослушанная часть — цветом, остальное — приглушённо; нажатие перематывает */
export function Waveform({
	peaks,
	progress,
	onSeek,
	className
}: {
	peaks: number[] | null
	progress: number
	onSeek?: (fraction: number) => void
	className?: string
}) {
	const ref = useRef<HTMLDivElement>(null)
	const count = useBarCount(ref)
	const bars = peaks
		? resample(peaks, count)
		: Array.from({ length: count }, () => 0.18)

	const seek = (clientX: number) => {
		const rect = ref.current?.getBoundingClientRect()
		if (!rect || !onSeek) return
		onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)))
	}

	return (
		<div
			ref={ref}
			role='slider'
			aria-label='Перемотка'
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progress * 100)}
			onPointerDown={event => {
				seek(event.clientX)
				const move = (e: PointerEvent) => seek(e.clientX)
				const up = () => {
					window.removeEventListener('pointermove', move)
					window.removeEventListener('pointerup', up)
				}
				window.addEventListener('pointermove', move)
				window.addEventListener('pointerup', up)
			}}
			className={cn(
				'flex h-7 cursor-pointer touch-none items-center gap-[2px]',
				className
			)}
		>
			{bars.map((value, i) => (
				<span
					key={i}
					className={cn(
						'w-[3px] shrink-0 rounded-full transition-colors duration-150',
						(i + 0.5) / bars.length <= progress ? 'bg-primary' : 'bg-white/25'
					)}
					style={{ height: `${Math.round(4 + value * 24)}px` }}
				/>
			))}
		</div>
	)
}

/** Панель записи: мигающая точка, время, живая волна, «Отмена» и круглая «Отправить» */
export function RecorderBar({
	stream,
	since,
	onCancel,
	onDone
}: {
	stream: MediaStream
	since: number
	onCancel: () => void
	onDone: () => void
}) {
	const [levels, setLevels] = useState<number[]>([])
	const [now, setNow] = useState(Date.now())
	const ref = useRef<HTMLDivElement>(null)
	const count = useBarCount(ref, 48)

	useEffect(() => {
		const context = new AudioContext()
		const analyser = context.createAnalyser()
		analyser.fftSize = 1024
		const source = context.createMediaStreamSource(stream)
		source.connect(analyser)
		const data = new Float32Array(analyser.fftSize)
		const timer = setInterval(() => {
			analyser.getFloatTimeDomainData(data)
			let sum = 0
			for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
			// Речь обычно тихая — усиливаем, чтобы волна была выразительной
			const level = Math.min(1, Math.sqrt(sum / data.length) * 6)
			setLevels(prev => [...prev.slice(-200), level])
			setNow(Date.now())
		}, 90)
		return () => {
			clearInterval(timer)
			source.disconnect()
			context.close().catch(() => {})
		}
	}, [stream])

	const seconds = (now - since) / 1000
	const time = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')},${Math.floor((seconds % 1) * 10)}`
	const visible = levels.slice(-count)
	const padded = [
		...Array.from({ length: Math.max(0, count - visible.length) }, () => 0),
		...visible
	]

	return (
		<div className='mb-3 flex items-center gap-3 rounded-[18px] border border-border bg-white/[0.04] py-2 pl-4 pr-2'>
			<span className='relative flex h-2.5 w-2.5 shrink-0'>
				<span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60' />
				<span className='relative inline-flex h-2.5 w-2.5 rounded-full bg-danger' />
			</span>
			<span className='w-14 shrink-0 font-mono text-sm tabular-nums text-fg'>
				{time}
			</span>
			<div
				ref={ref}
				className='flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden'
				aria-hidden
			>
				{padded.map((value, i) => (
					<span
						key={i}
						className='w-[3px] shrink-0 rounded-full bg-primary/80'
						style={{
							height: `${Math.round(3 + value * 26)}px`,
							opacity: value ? 1 : 0.25
						}}
					/>
				))}
			</div>
			<button
				type='button'
				onClick={onCancel}
				aria-label='Отменить запись'
				title='Отменить'
				className='grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-white/[0.06] hover:text-danger'
			>
				<Trash2 size={16} />
			</button>
			<button
				type='button'
				onClick={onDone}
				aria-label='Готово — вставить голосовое'
				title='Готово'
				className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[0_0_20px_rgb(var(--primary)/0.45)] transition-transform hover:scale-105 active:scale-95'
			>
				<ArrowUp size={18} />
			</button>
		</div>
	)
}
