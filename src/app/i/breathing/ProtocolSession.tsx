'use client'

import cn from 'clsx'
import {
	AlertTriangle,
	Maximize2,
	Minimize2,
	Pause,
	Play,
	RotateCcw,
	SkipForward,
	Smartphone,
	Square,
	Trophy,
	Volume2,
	VolumeX
} from 'lucide-react'
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react'
import { toast } from 'sonner'

import { breathingAudio } from './breathing-audio'
import {
	type IProtocol,
	MAX_HOLD_KEY,
	type ProtocolStep,
	estimateSeconds
} from './breathing-protocols'
import { usePreferences } from '@/lib/preferences'
import { sayCue } from '@/lib/speech'
import {
	type IBreathingSession,
	breathingService
} from '@/services/breathing.service'

interface IHoldRecord {
	round: number
	title: string
	seconds: number
}

interface Props {
	protocol: IProtocol
	sessions: IBreathingSession[]
	soundEnabled: boolean
	vibrationEnabled: boolean
	onToggleSound: () => void
	onToggleVibration: () => void
	onSaved: (session: IBreathingSession) => void
	onRunningChange: (running: boolean) => void
	onOpenProtocol: (id: string) => void
}

export const formatClock = (secs: number) => {
	const total = Math.max(0, Math.floor(secs))
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function readMax() {
	try {
		const value = Number(localStorage.getItem(MAX_HOLD_KEY))
		return value > 0 ? value : 0
	} catch {
		return 0
	}
}

function stopEffects() {
	for (const stop of [
		() => breathingAudio.stopBackgroundKeepAlive(),
		() => breathingAudio.releaseWakeLock()
	])
		try {
			stop()
		} catch {}
}

/** Сколько длится шаг; undefined — пока не нажмут «Вдохнул» */
const stepLength = (step: ProtocolStep) =>
	step.kind === 'breaths'
		? step.count * (step.inhale + step.exhale)
		: step.kind === 'hold'
			? step.seconds
			: step.seconds

/** Пошаговая программа: Вим Хоф, туммо, таблицы фридайвера и т. п. */
export function ProtocolSession({
	protocol,
	sessions,
	soundEnabled,
	vibrationEnabled,
	onToggleSound,
	onToggleVibration,
	onSaved,
	onRunningChange,
	onOpenProtocol
}: Props) {
	const [stage, setStage] = useState<'intro' | 'running' | 'done'>('intro')
	const [maxHold, setMaxHold] = useState(0)
	// Голосовые подсказки включаются в настройках («Озвучка»)
	const [{ breathingVoice: voiceEnabled }] = usePreferences()
	const [fullscreen, setFullscreen] = useState(false)
	const [stepIndex, setStepIndex] = useState(0)
	const [paused, setPaused] = useState(false)
	const [now, setNow] = useState(0)
	const [holds, setHolds] = useState<IHoldRecord[]>([])
	const [totalSeconds, setTotalSeconds] = useState(0)

	const steps = useMemo(
		() => protocol.build(maxHold || 120),
		[protocol, maxHold]
	)
	const step = steps[Math.min(stepIndex, steps.length - 1)]
	const rounds = Math.max(...steps.map(item => item.round))

	const stepStart = useRef(0)
	const pausedAt = useRef(0)
	const sessionStart = useRef(0)
	const pausedTotal = useRef(0)
	const holdsRef = useRef<IHoldRecord[]>([])
	const warned = useRef(false)
	const lastBreath = useRef(-1)

	useEffect(() => setMaxHold(readMax()), [])

	// Сменили программу — назад к описанию
	useEffect(() => {
		setStage('intro')
		setStepIndex(0)
		setPaused(false)
		stopEffects()
	}, [protocol.id])

	useEffect(
		() => onRunningChange(stage === 'running'),
		[stage, onRunningChange]
	)

	const say = useCallback(
		(text?: string) => {
			if (text && voiceEnabled) sayCue(text)
		},
		[voiceEnabled]
	)

	const cue = useCallback(
		(type: 'inhale' | 'holdIn' | 'exhale' | 'holdOut') => {
			if (soundEnabled) breathingAudio.playTone(type)
			if (vibrationEnabled) breathingAudio.vibrate(type)
		},
		[soundEnabled, vibrationEnabled]
	)

	const enterStep = useCallback(
		(index: number) => {
			const next = steps[index]
			stepStart.current = Date.now()
			warned.current = false
			lastBreath.current = -1
			setStepIndex(index)
			setNow(Date.now())
			say(next.voice)
			cue(
				next.kind === 'breaths'
					? 'inhale'
					: next.kind === 'hold'
						? next.lungs === 'in'
							? 'holdIn'
							: 'holdOut'
						: 'exhale'
			)
		},
		[steps, say, cue]
	)

	const finish = useCallback(
		async (completed: boolean) => {
			const elapsed = Math.round(
				(Date.now() - sessionStart.current - pausedTotal.current) / 1000
			)
			const records = holdsRef.current
			setTotalSeconds(elapsed)
			setHolds(records)
			setStage('done')
			setPaused(false)
			stopEffects()
			if (completed) {
				say('Готово. Отличная работа')
				if (soundEnabled) breathingAudio.playTone('exhale')
			}
			if (protocol.id === 'max-hold' && records.length) {
				const best = records[records.length - 1].seconds
				try {
					localStorage.setItem(MAX_HOLD_KEY, String(best))
				} catch {}
				setMaxHold(best)
			}
			if (elapsed < 15) return
			try {
				const res = await breathingService.saveSession({
					techniqueId: protocol.id,
					techniqueName: protocol.shortName,
					durationSeconds: elapsed,
					cyclesCount: Math.max(0, ...records.map(record => record.round)),
					details: { holds: records.map(record => record.seconds) }
				})
				if (res.data) onSaved(res.data)
			} catch {
				toast.error('Не удалось сохранить сеанс на сервере')
			}
		},
		[protocol, say, soundEnabled, onSaved]
	)

	/** Закончить текущий шаг: записать задержку и перейти дальше */
	const completeStep = useCallback(
		(timedOut: boolean) => {
			const current = steps[stepIndex]
			if (current.kind === 'hold' && current.record) {
				const held = timedOut
					? (current.seconds ?? 0)
					: Math.round((Date.now() - stepStart.current) / 1000)
				holdsRef.current = [
					...holdsRef.current,
					{ round: current.round, title: current.title, seconds: held }
				]
				setHolds(holdsRef.current)
			}
			if (stepIndex + 1 >= steps.length) void finish(true)
			else enterStep(stepIndex + 1)
		},
		[steps, stepIndex, enterStep, finish]
	)

	const start = () => {
		if (protocol.needsMax && !maxHold) {
			toast.info('Сначала узнай свой максимум', {
				description: 'Таблицы строятся от него — это займёт пару минут.'
			})
			onOpenProtocol('max-hold')
			return
		}
		sessionStart.current = Date.now()
		pausedTotal.current = 0
		holdsRef.current = []
		setHolds([])
		setPaused(false)
		setStage('running')
		breathingAudio.startBackgroundKeepAlive()
		breathingAudio.requestWakeLock()
		enterStep(0)
	}

	const togglePause = () => {
		if (paused) {
			const delta = Date.now() - pausedAt.current
			stepStart.current += delta
			pausedTotal.current += delta
			setPaused(false)
			breathingAudio.requestWakeLock()
		} else {
			pausedAt.current = Date.now()
			setPaused(true)
			breathingAudio.releaseWakeLock()
		}
	}

	// Ход времени
	useEffect(() => {
		if (stage !== 'running' || paused) return
		const timer = setInterval(() => setNow(Date.now()), 100)
		return () => clearInterval(timer)
	}, [stage, paused])

	const elapsed = Math.max(
		0,
		((paused ? pausedAt.current : now) - stepStart.current) / 1000
	)
	const length = stepLength(step)

	// Переходы, отсчёт и сигналы внутри шага
	useEffect(() => {
		if (stage !== 'running' || paused) return
		if (length !== undefined && elapsed >= length) {
			completeStep(true)
			return
		}
		if (step.kind === 'breaths') {
			const cycle = step.inhale + step.exhale
			const breath = Math.floor(elapsed / cycle)
			if (breath !== lastBreath.current) {
				lastBreath.current = breath
				// На медленном дыхании — лёгкий толчок на каждый вдох
				if (cycle >= 3 && breath > 0 && vibrationEnabled)
					breathingAudio.vibrate('inhale')
				if (breath === step.count - 3 && step.count >= 20) say('Ещё три')
			}
		} else if (
			length !== undefined &&
			length >= 30 &&
			length - elapsed <= 10 &&
			!warned.current
		) {
			warned.current = true
			say('Ещё десять секунд')
		}
	}, [
		elapsed,
		length,
		stage,
		paused,
		step,
		completeStep,
		say,
		vibrationEnabled
	])

	// Пробел — «Вдохнул» на задержке, Esc — выйти из полного экрана
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && fullscreen) setFullscreen(false)
			if (
				event.code === 'Space' &&
				stage === 'running' &&
				!paused &&
				step.kind === 'hold' &&
				!(event.target instanceof HTMLInputElement)
			) {
				event.preventDefault()
				completeStep(false)
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [fullscreen, stage, paused, step, completeStep])

	// Ушли со страницы — гасим всё
	useEffect(() => () => stopEffects(), [])

	const previousBest = useMemo(() => {
		const values = sessions
			.filter(session => session.technique_id === protocol.id)
			.flatMap(session => session.details?.holds ?? [])
		return values.length ? Math.max(...values) : 0
	}, [sessions, protocol.id])

	const controls = (
		<div className='flex items-center border border-border'>
			<Toggle
				label={soundEnabled ? 'Выключить звук' : 'Включить звук'}
				active={soundEnabled}
				onClick={onToggleSound}
			>
				{soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
			</Toggle>
			<Toggle
				label={vibrationEnabled ? 'Выключить вибрацию' : 'Включить вибрацию'}
				active={vibrationEnabled}
				onClick={onToggleVibration}
			>
				<Smartphone size={15} />
			</Toggle>
			<Toggle
				label={fullscreen ? 'Свернуть (Esc)' : 'На весь экран'}
				onClick={() => setFullscreen(value => !value)}
			>
				{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
			</Toggle>
		</div>
	)

	return (
		<section
			className={cn(
				'relative isolate flex flex-col overflow-hidden border-border bg-surface',
				fullscreen
					? 'fixed inset-0 z-[120] animate-fade-in bg-bg'
					: 'min-h-[560px] border'
			)}
		>
			<header className='flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5'>
				<div className='min-w-0'>
					<h2 className='truncate text-base font-semibold text-fg'>
						{protocol.name}
					</h2>
					<div className='mt-1.5 flex flex-wrap items-center gap-2 font-mono text-2xs uppercase tracking-wider text-subtle'>
						<Intensity level={protocol.intensity} />
						<span>≈ {Math.round(estimateSeconds(steps) / 60)} мин</span>
						{rounds > 0 && <span>· {rounds} раунд.</span>}
					</div>
				</div>
				{controls}
			</header>

			{stage === 'intro' && (
				<Intro
					protocol={protocol}
					maxHold={maxHold}
					previousBest={previousBest}
					onMaxChange={value => {
						setMaxHold(value)
						try {
							localStorage.setItem(MAX_HOLD_KEY, String(value))
						} catch {}
					}}
					onMeasure={() => onOpenProtocol('max-hold')}
					onStart={start}
				/>
			)}

			{stage === 'running' && (
				<>
					<div className='flex flex-1 flex-col items-center justify-center px-4 py-6'>
						<RoundDots
							rounds={rounds}
							current={step.round}
							accent={protocol.accent}
						/>
						<Orb
							step={step}
							elapsed={elapsed}
							length={length}
							paused={paused}
							accent={protocol.accent}
							large={fullscreen}
						/>
						<p className='mt-5 text-base font-medium text-fg'>{step.title}</p>
						<p className='mt-1 min-h-[2.5rem] max-w-md text-center text-sm leading-5 text-muted'>
							{paused ? 'Пауза' : step.hint}
						</p>
						{step.kind === 'hold' && (
							<button
								type='button'
								onClick={() => completeStep(false)}
								disabled={paused}
								className={cn(
									'mt-3 flex h-12 items-center gap-2 px-7 text-sm font-medium transition-colors disabled:opacity-40',
									step.seconds === undefined
										? 'bg-primary text-white hover:bg-primary-hover'
										: 'border border-border text-fg hover:bg-white/[0.05]'
								)}
							>
								{step.seconds === undefined
									? 'Вдохнул'
									: step.record
										? 'Вдохнул раньше'
										: 'Дальше'}
								<kbd className='key-hint hidden font-mono text-2xs opacity-60 sm:inline'>
									Пробел
								</kbd>
							</button>
						)}
					</div>
					<footer className='flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5'>
						<p className='font-mono text-xs tabular-nums text-subtle'>
							Шаг {stepIndex + 1} из {steps.length}
						</p>
						<div className='flex items-center gap-2'>
							<button
								type='button'
								onClick={togglePause}
								className={cn(
									'flex h-10 items-center gap-2 px-4 text-sm font-medium transition-colors',
									paused
										? 'bg-primary text-white hover:bg-primary-hover'
										: 'border border-border text-fg hover:bg-white/[0.05]'
								)}
							>
								{paused ? (
									<Play
										size={14}
										fill='currentColor'
									/>
								) : (
									<Pause size={14} />
								)}
								{paused ? 'Продолжить' : 'Пауза'}
							</button>
							<IconButton
								label='Следующий шаг'
								onClick={() => completeStep(false)}
							>
								<SkipForward size={14} />
							</IconButton>
							<IconButton
								label='Закончить и сохранить'
								onClick={() => void finish(false)}
							>
								<Square size={13} />
							</IconButton>
						</div>
					</footer>
				</>
			)}

			{stage === 'done' && (
				<Summary
					protocol={protocol}
					holds={holds}
					totalSeconds={totalSeconds}
					previousBest={previousBest}
					onAgain={start}
					onBack={() => setStage('intro')}
				/>
			)}
		</section>
	)
}

/* ---------- Описание до старта ---------- */

function Intro({
	protocol,
	maxHold,
	previousBest,
	onMaxChange,
	onMeasure,
	onStart
}: {
	protocol: IProtocol
	maxHold: number
	previousBest: number
	onMaxChange: (value: number) => void
	onMeasure: () => void
	onStart: () => void
}) {
	const Icon = protocol.icon
	return (
		<div className='flex flex-1 flex-col'>
			<div className='flex-1 overflow-y-auto px-4 py-5 sm:px-6'>
				<div className='flex items-start gap-4'>
					<span
						className='grid h-12 w-12 shrink-0 place-items-center rounded-full'
						style={{
							background: `${protocol.accent}22`,
							color: protocol.accent
						}}
					>
						<Icon size={22} />
					</span>
					<div className='min-w-0'>
						<p className='text-sm leading-6 text-muted'>{protocol.tagline}</p>
						{previousBest > 0 && (
							<p className='mt-1 flex items-center gap-1.5 text-xs text-subtle'>
								<Trophy
									size={12}
									className='text-warning'
								/>
								Лучшее: {formatClock(previousBest)} ·{' '}
								{protocol.metric.toLowerCase()}
							</p>
						)}
					</div>
				</div>

				<ol className='mt-5 space-y-3'>
					{protocol.howTo.map((line, index) => (
						<li
							key={line}
							className='grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-fg/90'
						>
							<span className='font-mono text-xs leading-6 text-subtle'>
								{index + 1}.
							</span>
							{line}
						</li>
					))}
				</ol>

				{protocol.needsMax && (
					<div className='mt-5 flex flex-wrap items-center gap-3 border border-border px-4 py-3'>
						<span className='text-sm text-muted'>Твой максимум</span>
						<input
							type='number'
							min={10}
							max={900}
							value={maxHold || ''}
							placeholder='сек'
							onChange={event => onMaxChange(Number(event.target.value) || 0)}
							className='h-9 w-20 border border-border bg-transparent px-2 font-mono text-sm tabular-nums text-fg outline-none focus:border-primary'
						/>
						<span className='font-mono text-xs text-subtle'>
							{maxHold ? formatClock(maxHold) : 'не задан'}
						</span>
						<button
							type='button'
							onClick={onMeasure}
							className='ml-auto text-xs text-primary transition-colors hover:text-primary-hover'
						>
							Замерить →
						</button>
					</div>
				)}

				{protocol.intensity >= 2 && (
					<div className='mt-5 flex gap-3 border border-warning/40 bg-warning/[0.06] px-4 py-3 text-sm leading-6'>
						<AlertTriangle
							size={16}
							className='mt-1 shrink-0 text-warning'
						/>
						<div className='text-fg/90'>
							<p className='font-medium text-fg'>
								Только сидя или лёжа, на суше
							</p>
							<p className='text-muted'>
								Никогда в воде, в ванне, за рулём или стоя: после частого
								дыхания можно потерять сознание без предупреждения. Не практикуй
								при эпилепсии, болезнях сердца, высоком давлении и беременности.
								Стало плохо — сразу дыши спокойно.
							</p>
						</div>
					</div>
				)}
			</div>
			<footer className='border-t border-border px-4 py-3 sm:px-5'>
				<button
					type='button'
					onClick={onStart}
					className='flex h-11 w-full items-center justify-center gap-2 bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover sm:ml-auto sm:w-auto'
				>
					<Play
						size={14}
						fill='currentColor'
					/>
					{protocol.intensity >= 2 ? 'Я сижу или лежу — начать' : 'Начать'}
				</button>
			</footer>
		</div>
	)
}

/* ---------- Итоги ---------- */

function Summary({
	protocol,
	holds,
	totalSeconds,
	previousBest,
	onAgain,
	onBack
}: {
	protocol: IProtocol
	holds: IHoldRecord[]
	totalSeconds: number
	previousBest: number
	onAgain: () => void
	onBack: () => void
}) {
	const best = holds.length ? Math.max(...holds.map(hold => hold.seconds)) : 0
	const scale = Math.max(best, previousBest, 1)
	const isRecord = best > 0 && best > previousBest
	return (
		<div className='flex flex-1 flex-col'>
			<div className='flex-1 overflow-y-auto px-4 py-6 sm:px-6'>
				<p className='eyebrow'>Готово</p>
				<div className='mt-2 flex flex-wrap items-end gap-x-8 gap-y-3'>
					<Stat
						label='Время'
						value={formatClock(totalSeconds)}
					/>
					{best > 0 && (
						<Stat
							label={protocol.metric}
							value={formatClock(best)}
						/>
					)}
					{isRecord && previousBest > 0 && (
						<p className='flex items-center gap-1.5 pb-1 text-sm text-warning'>
							<Trophy size={14} />
							Новый рекорд: +{best - previousBest} с
						</p>
					)}
				</div>

				{holds.length > 0 && (
					<ul className='mt-6 space-y-2'>
						{holds.map((hold, index) => (
							<li
								key={index}
								className='grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-xs'
							>
								<span className='truncate text-subtle'>
									{hold.round ? `Раунд ${hold.round}` : hold.title}
								</span>
								<span className='relative h-2 bg-white/[0.05]'>
									<span
										className='absolute inset-y-0 left-0'
										style={{
											width: `${(hold.seconds / scale) * 100}%`,
											background: protocol.accent
										}}
									/>
									{previousBest > 0 && (
										<span
											className='absolute inset-y-[-3px] w-px bg-fg/40'
											style={{ left: `${(previousBest / scale) * 100}%` }}
											title='Прошлый лучший'
										/>
									)}
								</span>
								<span className='text-right font-mono tabular-nums text-fg'>
									{formatClock(hold.seconds)}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
			<footer className='flex justify-end gap-2 border-t border-border px-4 py-3 sm:px-5'>
				<button
					type='button'
					onClick={onBack}
					className='h-10 border border-border px-4 text-sm text-fg transition-colors hover:bg-white/[0.05]'
				>
					К описанию
				</button>
				<button
					type='button'
					onClick={onAgain}
					className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
				>
					<RotateCcw size={14} />
					Ещё раз
				</button>
			</footer>
		</div>
	)
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className='text-2xs uppercase tracking-wider text-subtle'>{label}</p>
			<p className='font-mono text-3xl font-light tabular-nums text-fg'>
				{value}
			</p>
		</div>
	)
}

/* ---------- Форма, кольцо прогресса и раунды ---------- */

function Orb({
	step,
	elapsed,
	length,
	paused,
	accent,
	large
}: {
	step: ProtocolStep
	elapsed: number
	length: number | undefined
	paused: boolean
	accent: string
	large: boolean
}) {
	let scale = 0.75
	let transition = 600
	let big = ''
	let caption = ''
	let progress: number | null = null

	if (step.kind === 'breaths') {
		const cycle = step.inhale + step.exhale
		const breath = Math.min(step.count, Math.floor(elapsed / cycle) + 1)
		const inhaling = elapsed % cycle < step.inhale
		scale = inhaling ? 1 : step.style === 'pump' ? 0.8 : 0.58
		transition = (inhaling ? step.inhale : step.exhale) * 1000
		big = String(breath)
		caption = `из ${step.count} · ${inhaling ? (step.style === 'pump' ? 'вдох сам' : 'вдох') : 'выдох'}`
		progress = elapsed / (step.count * cycle)
	} else if (step.kind === 'hold') {
		scale = step.lungs === 'in' ? 1 : 0.55
		big =
			length !== undefined
				? String(Math.ceil(length - elapsed))
				: formatClock(elapsed)
		caption = step.lungs === 'in' ? 'на вдохе' : 'на выдохе'
		progress = length !== undefined ? elapsed / length : null
	} else {
		scale = step.lungs === 'in' ? 1 : step.lungs === 'out' ? 0.55 : 0.75
		big = String(Math.ceil(step.seconds - elapsed))
		caption = 'секунд'
		progress = elapsed / step.seconds
	}

	const size = large ? 360 : 280
	const radius = size / 2 - 6
	const circumference = 2 * Math.PI * radius
	const breathingFree = step.kind === 'rest' && !step.lungs

	return (
		<div
			className='relative my-4 grid shrink-0 place-items-center'
			style={{ width: size, height: size }}
		>
			<div
				aria-hidden
				className='pointer-events-none absolute -z-10 h-[220%] w-[220%] rounded-full'
				style={{
					background: `radial-gradient(circle, ${accent}40 0%, ${accent}14 30%, transparent 60%)`,
					opacity: 0.4 + scale * 0.5
				}}
			/>
			<svg
				className='absolute inset-0 -rotate-90'
				width={size}
				height={size}
				aria-hidden
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill='none'
					stroke='currentColor'
					strokeWidth={2}
					className='text-white/[0.06]'
				/>
				{progress !== null && (
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill='none'
						stroke={accent}
						strokeWidth={3}
						strokeLinecap='round'
						strokeDasharray={circumference}
						strokeDashoffset={circumference * (1 - Math.min(1, progress))}
						style={{ transition: 'stroke-dashoffset 120ms linear' }}
					/>
				)}
			</svg>
			<div
				className={cn(
					'absolute rounded-full',
					breathingFree &&
						!paused &&
						'animate-[orb-free_8s_ease-in-out_infinite]'
				)}
				style={{
					inset: size * 0.12,
					transform: breathingFree ? undefined : `scale(${scale})`,
					transition: `transform ${transition}ms cubic-bezier(0.45, 0, 0.55, 1)`,
					background: `radial-gradient(circle at 38% 32%, ${accent}66, ${accent}22 55%, ${accent}0d)`,
					boxShadow: `0 0 0 1px ${accent}55 inset, 0 0 60px ${accent}33`
				}}
			/>
			<div className='relative flex flex-col items-center text-center'>
				<span
					className={cn(
						'font-light tabular-nums leading-none tracking-tight text-fg',
						large ? 'text-8xl' : 'text-6xl'
					)}
				>
					{paused ? '‖' : big}
				</span>
				<span className='mt-2 font-mono text-2xs uppercase tracking-[0.2em] text-fg/70'>
					{caption}
				</span>
			</div>
		</div>
	)
}

function RoundDots({
	rounds,
	current,
	accent
}: {
	rounds: number
	current: number
	accent: string
}) {
	if (rounds < 2) return null
	return (
		<div className='mb-3 flex items-center gap-1.5'>
			{Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
				<span
					key={round}
					className='h-1.5 rounded-full transition-all'
					style={{
						width: round === current ? 22 : 8,
						background: round <= current ? accent : 'rgba(255,255,255,0.12)'
					}}
				/>
			))}
		</div>
	)
}

function Intensity({ level }: { level: 1 | 2 | 3 }) {
	const label = ['', 'Мягко', 'Интенсивно', 'Жёстко'][level]
	return (
		<span className='flex items-center gap-1'>
			{[1, 2, 3].map(i => (
				<span
					key={i}
					className={cn(
						'h-2 w-1',
						i <= level
							? level === 3
								? 'bg-danger'
								: 'bg-warning'
							: 'bg-white/15'
					)}
				/>
			))}
			<span className='ml-1'>{label}</span>
		</span>
	)
}

function Toggle({
	label,
	active,
	onClick,
	children
}: {
	label: string
	active?: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				'grid h-9 w-9 place-items-center border-r border-border transition-colors last:border-r-0',
				active ? 'text-primary' : 'text-subtle hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

function IconButton({
	label,
	onClick,
	children
}: {
	label: string
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			onClick={onClick}
			className='grid h-10 w-10 place-items-center border border-border text-subtle transition-colors hover:text-fg'
		>
			{children}
		</button>
	)
}
