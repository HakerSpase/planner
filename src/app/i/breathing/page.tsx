'use client'

import {
	Activity,
	Bell,
	Check,
	CloudRain,
	Headphones,
	Maximize2,
	Minimize2,
	Pause,
	Play,
	Radio,
	RotateCcw,
	Smartphone,
	Sparkles,
	Trash2,
	Trees,
	Volume2,
	VolumeX,
	Waves,
	X
} from 'lucide-react'
import cn from 'clsx'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
	BREATHING_TECHNIQUES,
	CUE_STYLE_OPTIONS,
	SOUNDSCAPE_OPTIONS,
	type CueStyleType,
	type IBreathingPhase,
	type IBreathingTechnique,
	type SoundscapeType
} from './breathing.types'
import { breathingAudio } from './breathing-audio'
import { BreathingCircle } from './BreathingCircle'
import { BreathingStats } from './BreathingStats'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Heading } from '@/components/ui/Heading'
import { useProfile } from '@/hooks/useProfile'
import { dateKeyInTimeZone } from '@/lib/time-zone'
import {
	breathingService,
	type IBreathingSession
} from '@/services/breathing.service'

interface IDurationOption {
	label: string
	seconds: number
}

const DURATIONS: IDurationOption[] = [
	{ label: '1', seconds: 60 },
	{ label: '2', seconds: 120 },
	{ label: '3', seconds: 180 },
	{ label: '5', seconds: 300 },
	{ label: '10', seconds: 600 },
	{ label: '∞', seconds: 0 }
]

export default function BreathingPage() {
	const [selectedTechnique, setSelectedTechnique] = useState<IBreathingTechnique>(
		BREATHING_TECHNIQUES[0]
	)
	const [targetDurationSeconds, setTargetDurationSeconds] = useState<number>(180) // 3 min default
	const [isActive, setIsActive] = useState<boolean>(false)
	const [isPaused, setIsPaused] = useState<boolean>(false)

	// Zen Mode, Audio Settings & Duration Modals
	const [isZenMode, setIsZenMode] = useState<boolean>(false)
	const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState<boolean>(false)
	const [sidebarTab, setSidebarTab] = useState<'catalog' | 'history'>('catalog')
	const [pendingTechnique, setPendingTechnique] = useState<IBreathingTechnique | null>(null)

	const { data: profile } = useProfile()
	const timeZone =
		profile?.user.timeZone ||
		Intl.DateTimeFormat().resolvedOptions().timeZone ||
		'UTC'

	// Phase and timing state
	const [currentPhaseIndex, setCurrentPhaseIndex] = useState<number>(0)
	const [phaseRemainingSeconds, setPhaseRemainingSeconds] = useState<number>(
		BREATHING_TECHNIQUES[0].phases[0].seconds
	)
	const [phaseProgress, setPhaseProgress] = useState<number>(0)
	const [totalElapsedSeconds, setTotalElapsedSeconds] = useState<number>(0)
	const [completedCycles, setCompletedCycles] = useState<number>(0)

	// User preferences (stored in localStorage)
	const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true)
	const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
	const [keepScreenOn, setKeepScreenOn] = useState<boolean>(true)

	// Soundscapes & Cues state
	const [soundscape, setSoundscape] = useState<SoundscapeType>('none')
	const [soundscapeVolume, setSoundscapeVolume] = useState<number>(45)
	const [cueStyle, setCueStyle] = useState<CueStyleType>('tibetan')
	const [cueVolume, setCueVolume] = useState<number>(65)

	// Sessions history
	const [sessions, setSessions] = useState<IBreathingSession[]>([])
	const [loadingHistory, setLoadingHistory] = useState<boolean>(true)
	const [sessionToDelete, setSessionToDelete] = useState<IBreathingSession | null>(null)
	const [isDeleting, setIsDeleting] = useState<boolean>(false)

	// Internal timing references
	const sessionStartTimeRef = useRef<number>(0)
	const phaseStartTimeRef = useRef<number>(0)
	const pausedAtRef = useRef<number>(0)
	const accumulatedElapsedRef = useRef<number>(0)
	// Актуальные значения для finishSession, который вызывается из интервала со старым замыканием
	const elapsedRef = useRef<number>(0)
	const cyclesRef = useRef<number>(0)
	const finishingRef = useRef(false)

	// Load user settings and sessions on mount
	useEffect(() => {
		try {
			const vib = localStorage.getItem('planner_breathing_vibe')
			if (vib !== null) setVibrationEnabled(vib === 'true')
			const snd = localStorage.getItem('planner_breathing_sound')
			if (snd !== null) setSoundEnabled(snd === 'true')

			const sc = localStorage.getItem('planner_breathing_soundscape') as SoundscapeType | null
			if (sc && ['none', 'rain', 'waves', 'forest', 'brown_noise'].includes(sc)) {
				setSoundscape(sc)
				breathingAudio.setSoundscape(sc)
			}
			const scVol = localStorage.getItem('planner_breathing_soundscape_vol')
			if (scVol !== null) {
				const v = Number(scVol)
				setSoundscapeVolume(v)
				breathingAudio.setSoundscapeVolume(v / 100)
			}
			const cue = localStorage.getItem('planner_breathing_cue_style') as CueStyleType | null
			if (cue && ['tibetan', 'bell', 'soft_sine', 'none'].includes(cue)) {
				setCueStyle(cue)
				breathingAudio.setCueStyle(cue)
			}
			const cueVol = localStorage.getItem('planner_breathing_cue_vol')
			if (cueVol !== null) {
				const v = Number(cueVol)
				setCueVolume(v)
				breathingAudio.setCueVolume(v / 100)
			}
		} catch {}

		loadHistory()
	}, [])

	// Пока идёт сеанс дыхания, фоновая музыка приложения затихает
	useEffect(() => {
		window.dispatchEvent(new CustomEvent('planner:breathing', { detail: { active: isActive } }))
	}, [isActive])
	useEffect(
		() => () => {
			window.dispatchEvent(new CustomEvent('planner:breathing', { detail: { active: false } }))
		},
		[]
	)

	// Ушли со страницы или закрыли вкладку — гасим весь звук и блокировку экрана
	useEffect(() => {
		const stop = () => breathingAudio.shutdown()
		window.addEventListener('pagehide', stop)
		return () => {
			window.removeEventListener('pagehide', stop)
			stop()
		}
	}, [])

	// Escape key listener for Modals & Zen Mode
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (isAudioSettingsOpen) {
					setIsAudioSettingsOpen(false)
					return
				}
				if (isZenMode) {
					setIsZenMode(false)
					return
				}
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [isAudioSettingsOpen, isZenMode])

	const loadHistory = async () => {
		try {
			setLoadingHistory(true)
			const res = await breathingService.getSessions()
			setSessions(res.data || [])
		} catch {
			// Ignore if not logged in or network error
		} finally {
			setLoadingHistory(false)
		}
	}

	const saveSessionToHistory = async (elapsed: number, cycles: number) => {
		if (elapsed < 15 && cycles === 0) {
			toast.info('Сеанс слишком короткий (<15 сек), запись не создана')
			return
		}
		try {
			const res = await breathingService.saveSession({
				techniqueId: selectedTechnique.id,
				techniqueName: selectedTechnique.name,
				durationSeconds: Math.round(elapsed),
				cyclesCount: cycles
			})
			if (res.data) {
				setSessions(prev => [res.data, ...prev])
				toast.success(
					`Сеанс записан: ${Math.round(elapsed / 60) || 1} мин, ${cycles} циклов`
				)
			}
		} catch {
			toast.error('Не удалось сохранить сеанс на сервере')
		}
	}

	const handleDeleteSession = async (id: string) => {
		try {
			await breathingService.deleteSession(id)
			setSessions(prev => prev.filter(s => s.id !== id))
			toast.success('Сеанс удалён из истории')
		} catch {
			toast.error('Ошибка при удалении сеанса')
		}
	}

	const toggleVibration = () => {
		const next = !vibrationEnabled
		setVibrationEnabled(next)
		try {
			localStorage.setItem('planner_breathing_vibe', String(next))
		} catch {}
		if (next) breathingAudio.vibrate('inhale')
	}

	const toggleSound = () => {
		const next = !soundEnabled
		setSoundEnabled(next)
		try {
			localStorage.setItem('planner_breathing_sound', String(next))
		} catch {}
		if (next) {
			breathingAudio.playTone('inhale')
			if (isActive && !isPaused && soundscape !== 'none') {
				breathingAudio.startSoundscape()
			}
		} else {
			breathingAudio.stopSoundscape()
		}
	}

	const handleSoundscapeChange = (type: SoundscapeType) => {
		setSoundscape(type)
		breathingAudio.setSoundscape(type)
		try {
			localStorage.setItem('planner_breathing_soundscape', type)
		} catch {}
		if (isActive && !isPaused && soundEnabled) {
			if (type === 'none') breathingAudio.stopSoundscape()
			else breathingAudio.startSoundscape()
		}
	}

	const handleSoundscapeVolumeChange = (vol: number) => {
		setSoundscapeVolume(vol)
		breathingAudio.setSoundscapeVolume(vol / 100)
		try {
			localStorage.setItem('planner_breathing_soundscape_vol', String(vol))
		} catch {}
	}

	const handleCueStyleChange = (style: CueStyleType) => {
		setCueStyle(style)
		breathingAudio.setCueStyle(style)
		try {
			localStorage.setItem('planner_breathing_cue_style', style)
		} catch {}
		if (soundEnabled && style !== 'none') {
			breathingAudio.playTone('inhale')
		}
	}

	const handleCueVolumeChange = (vol: number) => {
		setCueVolume(vol)
		breathingAudio.setCueVolume(vol / 100)
		try {
			localStorage.setItem('planner_breathing_cue_vol', String(vol))
		} catch {}
	}

	const toggleZenMode = () => {
		setIsZenMode(prev => {
			const next = !prev
			if (next) {
				try {
					if (document.documentElement.requestFullscreen) {
						document.documentElement.requestFullscreen().catch(() => {})
					}
				} catch {}
			} else {
				try {
					if (document.fullscreenElement && document.exitFullscreen) {
						document.exitFullscreen().catch(() => {})
					}
				} catch {}
			}
			return next
		})
	}

	// Trigger haptics and audio on phase change
	const notifyPhaseChange = useCallback(
		(phase: IBreathingPhase) => {
			if (vibrationEnabled) breathingAudio.vibrate(phase.type)
			if (soundEnabled) breathingAudio.playTone(phase.type)
		},
		[vibrationEnabled, soundEnabled]
	)

	// Main tick loop
	useEffect(() => {
		if (!isActive || isPaused) return

		const interval = setInterval(() => {
			const now = Date.now()
			const currentPhase = selectedTechnique.phases[currentPhaseIndex]
			const phaseDurationMs = currentPhase.seconds * 1000
			const timeInCurrentPhase = now - phaseStartTimeRef.current

			// Total session time
			const currentSessionElapsed =
				accumulatedElapsedRef.current +
				Math.floor((now - sessionStartTimeRef.current) / 1000)
			setTotalElapsedSeconds(currentSessionElapsed)
			elapsedRef.current = currentSessionElapsed

			// Check target duration
			if (
				targetDurationSeconds > 0 &&
				currentSessionElapsed >= targetDurationSeconds
			) {
				clearInterval(interval)
				// Через ref — у интервала замыкание старого рендера
				finishRef.current(true)
				return
			}

			// Phase progress and remaining seconds
			if (timeInCurrentPhase >= phaseDurationMs) {
				// Transition to next phase
				const nextIndex =
					(currentPhaseIndex + 1) % selectedTechnique.phases.length
				const nextPhase = selectedTechnique.phases[nextIndex]

				if (nextIndex === 0) {
					cyclesRef.current += 1
					setCompletedCycles(cyclesRef.current)
				}

				setCurrentPhaseIndex(nextIndex)
				phaseStartTimeRef.current = now
				setPhaseRemainingSeconds(nextPhase.seconds)
				setPhaseProgress(0)

				notifyPhaseChange(nextPhase)
			} else {
				const remaining = Math.max(
					0,
					(phaseDurationMs - timeInCurrentPhase) / 1000
				)
				setPhaseRemainingSeconds(remaining)
				setPhaseProgress(timeInCurrentPhase / phaseDurationMs)
			}
		}, 60)

		return () => clearInterval(interval)
	}, [
		isActive,
		isPaused,
		currentPhaseIndex,
		selectedTechnique,
		targetDurationSeconds,
		notifyPhaseChange
	])

	const startSession = () => {
		const now = Date.now()
		sessionStartTimeRef.current = now
		phaseStartTimeRef.current = now
		accumulatedElapsedRef.current = 0
		elapsedRef.current = 0
		cyclesRef.current = 0
		finishingRef.current = false
		setTotalElapsedSeconds(0)
		setCompletedCycles(0)
		setCurrentPhaseIndex(0)

		const firstPhase = selectedTechnique.phases[0]
		setPhaseRemainingSeconds(firstPhase.seconds)
		setPhaseProgress(0)
		setIsActive(true)
		setIsPaused(false)

		breathingAudio.startBackgroundKeepAlive()
		if (soundEnabled && soundscape !== 'none') {
			breathingAudio.startSoundscape()
		}
		if (keepScreenOn) breathingAudio.requestWakeLock()
		notifyPhaseChange(firstPhase)
	}

	const pauseSession = () => {
		setIsPaused(true)
		pausedAtRef.current = Date.now()
		accumulatedElapsedRef.current += Math.floor(
			(Date.now() - sessionStartTimeRef.current) / 1000
		)
		breathingAudio.stopSoundscape()
		breathingAudio.stopBackgroundKeepAlive()
		breathingAudio.releaseWakeLock()
	}

	const resumeSession = () => {
		const now = Date.now()
		const pauseDelta = now - pausedAtRef.current
		sessionStartTimeRef.current = now
		phaseStartTimeRef.current += pauseDelta
		setIsPaused(false)

		breathingAudio.startBackgroundKeepAlive()
		if (soundEnabled && soundscape !== 'none') {
			breathingAudio.startSoundscape()
		}
		if (keepScreenOn) breathingAudio.requestWakeLock()
	}

	// Сеанс закончился сам (вышло время) или по кнопке «Завершить» — в обоих случаях
	// сначала записываем его, а звук и блокировку экрана гасим после: если браузер
	// откажет в чём-то из этого, запись всё равно не потеряется
	const finishSession = (completed = false) => {
		if (finishingRef.current) return
		finishingRef.current = true
		const finalElapsed = completed
			? Math.max(elapsedRef.current, targetDurationSeconds)
			: elapsedRef.current
		const finalCycles = cyclesRef.current
		setIsActive(false)
		setIsPaused(false)
		saveSessionToHistory(finalElapsed, finalCycles)
		if (completed) {
			try {
				if (soundEnabled) breathingAudio.playTone('exhale')
				if (vibrationEnabled) navigator.vibrate?.([60, 80, 60])
			} catch {}
		}
		for (const stop of [
			() => breathingAudio.stopSoundscape(),
			() => breathingAudio.stopBackgroundKeepAlive(),
			() => breathingAudio.releaseWakeLock()
		]) {
			try {
				stop()
			} catch {}
		}
	}
	const finishRef = useRef(finishSession)
	finishRef.current = finishSession
	const activeRef = useRef(false)
	activeRef.current = isActive
	// Ушли со страницы посреди сеанса — он тоже попадает в историю
	useEffect(
		() => () => {
			if (activeRef.current) finishRef.current()
		},
		[]
	)

	const resetSession = () => {
		elapsedRef.current = 0
		cyclesRef.current = 0
		setIsActive(false)
		setIsPaused(false)
		setTotalElapsedSeconds(0)
		setCompletedCycles(0)
		setCurrentPhaseIndex(0)
		setPhaseRemainingSeconds(selectedTechnique.phases[0].seconds)
		setPhaseProgress(0)
		breathingAudio.stopSoundscape()
		breathingAudio.stopBackgroundKeepAlive()
		breathingAudio.releaseWakeLock()
	}

	const selectTechnique = (tech: IBreathingTechnique) => {
		if (tech.id === selectedTechnique.id) return
		if (isActive) {
			setPendingTechnique(tech)
			return
		}
		applyTechnique(tech)
	}

	const applyTechnique = (tech: IBreathingTechnique) => {
		setSelectedTechnique(tech)
		setCurrentPhaseIndex(0)
		setPhaseRemainingSeconds(tech.phases[0].seconds)
		setPhaseProgress(0)
	}

	const currentPhase = selectedTechnique.phases[currentPhaseIndex]

	const formatTime = (secs: number) => {
		const m = Math.floor(secs / 60)
		const s = Math.floor(secs % 60)
		return `${m}:${s < 10 ? '0' : ''}${s}`
	}

	const sessionProgress =
		isActive && targetDurationSeconds > 0
			? Math.min(100, (totalElapsedSeconds / targetDurationSeconds) * 100)
			: 0

	// История по дням: «Сегодня», «Вчера», дальше дата
	const todayKey = dateKeyInTimeZone(new Date(), timeZone)
	const yesterdayKey = dateKeyInTimeZone(
		new Date(Date.now() - 24 * 60 * 60 * 1000),
		timeZone
	)
	const historyGroups = sessions.reduce<
		{ key: string; label: string; items: IBreathingSession[] }[]
	>((groups, session) => {
		const key = dateKeyInTimeZone(new Date(session.created_at), timeZone)
		let group = groups.find(item => item.key === key)
		if (!group) {
			group = {
				key,
				label:
					key === todayKey
						? 'Сегодня'
						: key === yesterdayKey
							? 'Вчера'
							: new Date(session.created_at).toLocaleDateString('ru-RU', {
									day: 'numeric',
									month: 'long',
									timeZone
								}),
				items: []
			}
			groups.push(group)
		}
		group.items.push(session)
		return groups
	}, [])

	const getSoundscapeIcon = (type: SoundscapeType) => {
		switch (type) {
			case 'rain':
				return CloudRain
			case 'waves':
				return Waves
			case 'forest':
				return Trees
			case 'brown_noise':
				return Radio
			default:
				return VolumeX
		}
	}

	const CUE_ICONS: Record<CueStyleType, typeof Bell> = {
		tibetan: Sparkles,
		bell: Bell,
		soft_sine: Activity,
		none: VolumeX
	}

	/* Последовательность фаз: «Вдох 4 — Задержка 7 — Выдох 8» */
	const phaseStrip = (
		<ol className='flex flex-wrap items-center gap-x-1 gap-y-1 font-mono text-2xs uppercase tracking-wider'>
			{selectedTechnique.phases.map((phase, index) => {
				const isCurrent = isActive && index === currentPhaseIndex
				return (
					<li
						key={`${phase.type}-${index}`}
						className='flex items-center gap-1'
					>
						{index > 0 && <span className='text-white/15'>—</span>}
						<span
							className={cn(
								'px-1.5 py-0.5 transition-colors',
								isCurrent ? 'bg-primary text-white' : 'text-subtle'
							)}
						>
							{phase.name} {phase.seconds}
						</span>
					</li>
				)
			})}
		</ol>
	)

	/* Переключатели звука/вибрации — используются и на странице, и в дзен-режиме */
	const feedbackControls = (
		<div className='flex items-center border border-border'>
			<IconToggle
				label={
					soundscape === 'none'
						? 'Фоновый звук и сигналы'
						: `Фон: ${SOUNDSCAPE_OPTIONS.find(s => s.id === soundscape)?.label}`
				}
				active={soundscape !== 'none'}
				onClick={() => setIsAudioSettingsOpen(true)}
			>
				<Headphones size={15} />
			</IconToggle>
			<IconToggle
				label={soundEnabled ? 'Выключить звук' : 'Включить звук'}
				active={soundEnabled}
				onClick={toggleSound}
			>
				{soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
			</IconToggle>
			<IconToggle
				label={vibrationEnabled ? 'Выключить вибрацию' : 'Включить вибрацию'}
				active={vibrationEnabled}
				onClick={toggleVibration}
			>
				<Smartphone size={15} />
			</IconToggle>
			<IconToggle
				label={isZenMode ? 'Выйти из дзен-режима (Esc)' : 'Дзен-режим на весь экран'}
				onClick={toggleZenMode}
			>
				{isZenMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
			</IconToggle>
		</div>
	)

	/* Нижняя панель: выбор времени + старт, либо таймер + управление */
	const sessionControls = (size: 'md' | 'lg') => {
		const h = size === 'lg' ? 'h-11' : 'h-10'
		return !isActive ? (
			<div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
				<div className='flex items-center gap-3'>
					<span className='eyebrow'>Минут</span>
					<div
						role='radiogroup'
						aria-label='Длительность сеанса'
						className='flex divide-x divide-border border border-border'
					>
						{DURATIONS.map(duration => (
							<button
								key={duration.seconds}
								type='button'
								role='radio'
								aria-checked={targetDurationSeconds === duration.seconds}
								title={duration.seconds ? `${duration.label} мин` : 'Без ограничения'}
								onClick={() => setTargetDurationSeconds(duration.seconds)}
								className={cn(
									'h-9 min-w-9 px-2 font-mono text-xs tabular-nums transition-colors',
									targetDurationSeconds === duration.seconds
										? 'bg-white/[0.08] text-fg'
										: 'text-subtle hover:text-fg'
								)}
							>
								{duration.label}
							</button>
						))}
					</div>
				</div>
				<button
					type='button'
					onClick={startSession}
					className={cn(
						'flex items-center justify-center gap-2 bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary-hover',
						h
					)}
				>
					<Play
						size={14}
						fill='currentColor'
					/>
					Начать
				</button>
			</div>
		) : (
			<div className='flex w-full flex-wrap items-center justify-between gap-3'>
				<p className='font-mono tabular-nums'>
					<span className='text-lg text-fg'>{formatTime(totalElapsedSeconds)}</span>
					<span className='text-xs text-subtle'>
						{targetDurationSeconds > 0
							? ` / ${formatTime(targetDurationSeconds)}`
							: ' · без лимита'}
					</span>
				</p>
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={isPaused ? resumeSession : pauseSession}
						className={cn(
							'flex items-center gap-2 px-4 text-sm font-medium transition-colors',
							h,
							isPaused
								? 'bg-primary text-white hover:bg-primary-hover'
								: 'border border-border text-fg hover:bg-white/[0.05]'
						)}
					>
						{isPaused ? (
							<Play
								size={14}
								fill='currentColor'
							/>
						) : (
							<Pause size={14} />
						)}
						{isPaused ? 'Продолжить' : 'Пауза'}
					</button>
					<button
						type='button'
						onClick={() => finishSession()}
						className={cn(
							'flex items-center gap-2 border border-border px-4 text-sm font-medium text-fg transition-colors hover:border-success/50 hover:text-success',
							h
						)}
					>
						<Check size={14} />
						Завершить
					</button>
					<button
						type='button'
						onClick={resetSession}
						title='Сбросить без сохранения'
						aria-label='Сбросить без сохранения'
						className={cn(
							'grid place-items-center border border-border text-subtle transition-colors hover:text-fg',
							h,
							size === 'lg' ? 'w-11' : 'w-10'
						)}
					>
						<RotateCcw size={14} />
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='w-full pb-16'>
			<Heading
				title='Дыхание'
				description='Короткие практики, чтобы вернуть фокус и снять напряжение'
			/>

			<BreathingStats
				sessions={sessions}
				timeZone={timeZone}
				isLoading={loadingHistory}
			/>

			<div className='mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]'>
				{/* Сцена практики */}
				<section className='relative isolate flex min-h-[560px] flex-col overflow-hidden border border-border bg-surface'>
					<header className='flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5'>
						<div className='min-w-0'>
							<h2 className='truncate text-base font-semibold text-fg'>
								{selectedTechnique.name}
							</h2>
							<div className='mt-1.5'>{phaseStrip}</div>
						</div>
						{feedbackControls}
					</header>

					<div className='flex flex-1 flex-col items-center justify-center px-4 py-6'>
						<BreathingCircle
							technique={selectedTechnique}
							currentPhase={currentPhase}
							phaseRemainingSeconds={phaseRemainingSeconds}
							phaseProgress={phaseProgress}
							isActive={isActive}
							isPaused={isPaused}
							cycleCount={completedCycles}
						/>
						<p className='mt-5 min-h-[2.5rem] max-w-md text-center text-sm leading-5 text-muted'>
							{isActive ? (isPaused ? 'Пауза' : currentPhase.hint) : selectedTechnique.tagline}
						</p>
					</div>

					<footer className='relative border-t border-border px-4 py-3 sm:px-5'>
						{sessionProgress > 0 && (
							<div
								className='absolute -top-px left-0 h-px bg-primary transition-[width] duration-300 ease-linear'
								style={{ width: `${sessionProgress}%` }}
							/>
						)}
						{sessionControls('md')}
					</footer>
				</section>

				{/* Каталог и история */}
				<aside className='flex flex-col border border-border bg-surface lg:h-[560px]'>
					<div
						role='tablist'
						className='grid shrink-0 grid-cols-2 divide-x divide-border border-b border-border'
					>
						{(
							[
								['catalog', 'Практики', BREATHING_TECHNIQUES.length],
								['history', 'История', sessions.length]
							] as const
						).map(([tab, label, count]) => (
							<button
								key={tab}
								type='button'
								role='tab'
								aria-selected={sidebarTab === tab}
								onClick={() => setSidebarTab(tab)}
								className={cn(
									'flex h-11 items-center justify-center gap-2 text-sm font-medium transition-colors',
									sidebarTab === tab
										? 'bg-white/[0.04] text-fg'
										: 'text-subtle hover:text-fg'
								)}
							>
								{label}
								<span className='font-mono text-2xs text-subtle'>{count}</span>
							</button>
						))}
					</div>

					<div className='min-h-0 flex-1 overflow-y-auto'>
						{sidebarTab === 'catalog' ? (
							<ul>
								{BREATHING_TECHNIQUES.map((tech, index) => {
									const isSelected = tech.id === selectedTechnique.id
									return (
										<li key={tech.id}>
											<button
												type='button'
												onClick={() => selectTechnique(tech)}
												aria-pressed={isSelected}
												className={cn(
													'relative grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-2 border-b border-border px-4 py-3.5 text-left transition-colors',
													isSelected
														? 'bg-white/[0.04] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary'
														: 'hover:bg-white/[0.02]'
												)}
											>
												<span className='pt-0.5 font-mono text-xs text-subtle'>
													{String(index + 1).padStart(2, '0')}
												</span>
												<span className='min-w-0'>
													<span
														className={cn(
															'block truncate text-sm font-medium',
															isSelected ? 'text-fg' : 'text-muted'
														)}
													>
														{tech.shortName || tech.name}
													</span>
													<span className='mt-0.5 block text-xs leading-5 text-subtle'>
														{tech.tagline}
													</span>
												</span>
												<span className='pt-0.5 font-mono text-2xs text-subtle'>
													{tech.totalCycleSeconds} с
												</span>
											</button>
										</li>
									)
								})}
							</ul>
						) : loadingHistory ? (
							<div className='space-y-px p-4'>
								{[0, 1, 2, 3].map(item => (
									<div
										key={item}
										className='h-12 animate-pulse bg-white/[0.03]'
									/>
								))}
							</div>
						) : sessions.length === 0 ? (
							<div className='px-6 py-14 text-center'>
								<p className='text-sm text-muted'>Пока ни одного сеанса</p>
								<p className='mt-1 text-xs leading-5 text-subtle'>
									Сеанс сохранится сам, когда закончится время или вы нажмёте
									«Завершить».
								</p>
							</div>
						) : (
							historyGroups.map(group => {
								const minutes = Math.round(
									group.items.reduce((sum, item) => sum + item.duration_seconds, 0) /
										60
								)
								return (
									<section key={group.key}>
										<h3 className='sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-2'>
											<span className='eyebrow'>{group.label}</span>
											<span className='font-mono text-2xs text-subtle'>
												{minutes} мин
											</span>
										</h3>
										<ul>
											{group.items.map(session => (
												<li
													key={session.id}
													className='group flex items-center gap-3 border-b border-border px-4 py-2.5'
												>
													<span className='w-11 shrink-0 font-mono text-xs text-subtle'>
														{new Date(session.created_at).toLocaleTimeString('ru-RU', {
															hour: '2-digit',
															minute: '2-digit',
															timeZone
														})}
													</span>
													<span className='min-w-0 flex-1 truncate text-sm text-fg'>
														{BREATHING_TECHNIQUES.find(
															tech => tech.id === session.technique_id
														)?.shortName || session.technique_name}
													</span>
													<span className='shrink-0 font-mono text-xs tabular-nums text-muted'>
														{Math.max(1, Math.round(session.duration_seconds / 60))} мин
														<span className='text-subtle'> · {session.cycles_count} ц</span>
													</span>
													<button
														type='button'
														onClick={() => setSessionToDelete(session)}
														aria-label='Удалить запись'
														className='grid h-7 w-7 shrink-0 place-items-center text-subtle opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100'
													>
														<Trash2 size={13} />
													</button>
												</li>
											))}
										</ul>
									</section>
								)
							})
						)}
					</div>
				</aside>
			</div>

			{/* Дзен-режим: только форма, фаза и управление */}
			{isZenMode && (
				<div className='fixed inset-0 z-[120] isolate flex animate-fade-in select-none flex-col overflow-hidden bg-bg'>
					<header className='flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8'>
						<div className='min-w-0'>
							<p className='truncate text-sm font-medium text-fg'>
								{selectedTechnique.name}
							</p>
							<div className='mt-1.5 hidden sm:block'>{phaseStrip}</div>
						</div>
						{feedbackControls}
					</header>

					<div className='flex flex-1 flex-col items-center justify-center px-4'>
						<BreathingCircle
							technique={selectedTechnique}
							currentPhase={currentPhase}
							phaseRemainingSeconds={phaseRemainingSeconds}
							phaseProgress={phaseProgress}
							isActive={isActive}
							isPaused={isPaused}
							cycleCount={completedCycles}
							isZen
						/>
						<p className='mt-6 min-h-[3rem] max-w-md text-center text-base leading-6 text-muted'>
							{isActive ? (isPaused ? 'Пауза' : currentPhase.hint) : selectedTechnique.tagline}
						</p>
					</div>

					<footer className='relative border-t border-border px-4 py-4 sm:px-8'>
						{sessionProgress > 0 && (
							<div
								className='absolute -top-px left-0 h-px bg-primary transition-[width] duration-300 ease-linear'
								style={{ width: `${sessionProgress}%` }}
							/>
						)}
						<div className='mx-auto max-w-3xl'>{sessionControls('lg')}</div>
					</footer>
				</div>
			)}

			{/* Звук: фон природы и сигнал смены фазы */}
			{isAudioSettingsOpen && (
				<div
					className='fixed inset-0 z-[130] flex animate-fade-in items-center justify-center bg-black/60 p-4'
					onMouseDown={e => {
						if (e.target === e.currentTarget) setIsAudioSettingsOpen(false)
					}}
				>
					<div
						role='dialog'
						aria-modal='true'
						aria-labelledby='breathing-audio-title'
						className='w-full max-w-lg animate-pop-in border border-border bg-elevated shadow-pop'
					>
						<header className='flex items-center justify-between border-b border-border px-5 py-4'>
							<h3
								id='breathing-audio-title'
								className='text-base font-semibold text-fg'
							>
								Звук
							</h3>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(false)}
								aria-label='Закрыть'
								className='grid h-8 w-8 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
							>
								<X size={17} />
							</button>
						</header>

						<section className='border-b border-border px-5 py-4'>
							<p className='eyebrow'>Фон</p>
							<div className='mt-3 grid grid-cols-2 border-l border-t border-border sm:grid-cols-3'>
								{SOUNDSCAPE_OPTIONS.map(option => {
									const Icon = getSoundscapeIcon(option.id)
									const isSelected = soundscape === option.id
									return (
										<button
											key={option.id}
											type='button'
											onClick={() => handleSoundscapeChange(option.id)}
											aria-pressed={isSelected}
											className={cn(
												'flex flex-col items-start gap-1 border-b border-r border-border p-3 text-left transition-colors',
												isSelected ? 'bg-white/[0.06] text-fg' : 'text-muted hover:text-fg'
											)}
										>
											<Icon
												size={15}
												className={isSelected ? 'text-primary' : 'text-subtle'}
											/>
											<span className='text-sm'>{option.label}</span>
										</button>
									)
								})}
							</div>
							{soundscape !== 'none' && (
								<VolumeSlider
									label='Громкость фона'
									value={soundscapeVolume}
									onChange={handleSoundscapeVolumeChange}
								/>
							)}
						</section>

						<section className='px-5 py-4'>
							<div className='flex items-center justify-between'>
								<p className='eyebrow'>Сигнал смены фазы</p>
								<button
									type='button'
									onClick={() => breathingAudio.playTone('inhale')}
									className='flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg'
								>
									<Play
										size={11}
										fill='currentColor'
									/>
									Прослушать
								</button>
							</div>
							<div className='mt-3 grid grid-cols-2 border-l border-t border-border'>
								{CUE_STYLE_OPTIONS.map(option => {
									const Icon = CUE_ICONS[option.id]
									const isSelected = cueStyle === option.id
									return (
										<button
											key={option.id}
											type='button'
											onClick={() => handleCueStyleChange(option.id)}
											aria-pressed={isSelected}
											className={cn(
												'flex items-start gap-2.5 border-b border-r border-border p-3 text-left transition-colors',
												isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
											)}
										>
											<Icon
												size={15}
												className={cn('mt-0.5 shrink-0', isSelected ? 'text-primary' : 'text-subtle')}
											/>
											<span className='min-w-0'>
												<span className={cn('block text-sm', isSelected ? 'text-fg' : 'text-muted')}>
													{option.label}
												</span>
												<span className='block text-xs text-subtle'>{option.description}</span>
											</span>
										</button>
									)
								})}
							</div>
							{cueStyle !== 'none' && (
								<VolumeSlider
									label='Громкость сигнала'
									value={cueVolume}
									onChange={handleCueVolumeChange}
								/>
							)}
						</section>
					</div>
				</div>
			)}

			{pendingTechnique && (
				<ConfirmDialog
					open
					title='Сменить практику?'
					description={`Текущий сеанс прервётся без сохранения, и начнётся «${pendingTechnique.shortName || pendingTechnique.name}».`}
					confirmLabel='Сменить'
					onConfirm={() => {
						resetSession()
						applyTechnique(pendingTechnique)
						setPendingTechnique(null)
					}}
					onClose={() => setPendingTechnique(null)}
				/>
			)}

			{sessionToDelete && (
				<ConfirmDialog
					open
					title='Удалить сеанс?'
					description={`«${sessionToDelete.technique_name}», ${Math.max(1, Math.round(sessionToDelete.duration_seconds / 60))} мин — запись исчезнет из истории и статистики.`}
					confirmLabel='Удалить'
					isPending={isDeleting}
					onConfirm={async () => {
						setIsDeleting(true)
						await handleDeleteSession(sessionToDelete.id)
						setIsDeleting(false)
						setSessionToDelete(null)
					}}
					onClose={() => setSessionToDelete(null)}
				/>
			)}
		</div>
	)
}

function IconToggle({
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

function VolumeSlider({
	label,
	value,
	onChange
}: {
	label: string
	value: number
	onChange: (value: number) => void
}) {
	return (
		<label className='mt-4 flex items-center gap-3'>
			<span className='w-36 shrink-0 text-xs text-muted'>{label}</span>
			<input
				type='range'
				min={0}
				max={100}
				value={value}
				onChange={event => onChange(Number(event.target.value))}
				className='h-1 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
			/>
			<span className='w-9 text-right font-mono text-xs tabular-nums text-subtle'>
				{value}%
			</span>
		</label>
	)
}
