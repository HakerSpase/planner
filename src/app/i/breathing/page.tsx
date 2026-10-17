'use client'

import {
	Activity,
	Bell,
	Check,
	ChevronDown,
	Clock,
	CloudRain,
	Headphones,
	History,
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
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
	breathingService,
	type IBreathingSession
} from '@/services/breathing.service'

interface IDurationOption {
	label: string
	seconds: number
	description?: string
}

const DURATIONS: IDurationOption[] = [
	{
		label: '1 мин',
		seconds: 60,
		description: 'Быстрая пауза для снятия резкого стресса'
	},
	{
		label: '2 мин',
		seconds: 120,
		description: 'Короткая перезагрузка между делами'
	},
	{
		label: '3 мин',
		seconds: 180,
		description: 'Оптимальный баланс для ежедневной практики'
	},
	{
		label: '5 мин',
		seconds: 300,
		description: 'Глубокое погружение, нормализация пульса и давления'
	},
	{
		label: '10 мин',
		seconds: 600,
		description: 'Полная медитативная сессия для глубокого спокойствия'
	},
	{
		label: 'Без лимита',
		seconds: 0,
		description: 'Свободная практика в собственном ритме без таймера'
	}
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
	const [isDurationModalOpen, setIsDurationModalOpen] = useState<boolean>(false)
	const [sidebarTab, setSidebarTab] = useState<'catalog' | 'history'>('catalog')

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

	// Escape key listener for Modals & Zen Mode
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (isDurationModalOpen) {
					setIsDurationModalOpen(false)
					return
				}
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
	}, [isDurationModalOpen, isAudioSettingsOpen, isZenMode])

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

			// Check target duration
			if (
				targetDurationSeconds > 0 &&
				currentSessionElapsed >= targetDurationSeconds
			) {
				finishSession()
				return
			}

			// Phase progress and remaining seconds
			if (timeInCurrentPhase >= phaseDurationMs) {
				// Transition to next phase
				const nextIndex =
					(currentPhaseIndex + 1) % selectedTechnique.phases.length
				const nextPhase = selectedTechnique.phases[nextIndex]

				if (nextIndex === 0) {
					setCompletedCycles(c => c + 1)
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

	const finishSession = () => {
		const finalElapsed = totalElapsedSeconds
		const finalCycles = completedCycles
		setIsActive(false)
		setIsPaused(false)
		breathingAudio.stopSoundscape()
		breathingAudio.stopBackgroundKeepAlive()
		breathingAudio.releaseWakeLock()

		saveSessionToHistory(finalElapsed, finalCycles)
	}

	const resetSession = () => {
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
		if (isActive) {
			if (!confirm('Прервать текущий сеанс дыхания и выбрать другую практику?'))
				return
			resetSession()
		}
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

	// Calculate stats
	const todayDateString = new Date().toISOString().split('T')[0]
	const todaySessions = sessions.filter(
		s => s.created_at && s.created_at.startsWith(todayDateString)
	)
	const todayTotalMinutes = Math.round(
		todaySessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60
	)

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

	return (
		<div className='w-full pb-16'>
			{/* Page Header */}
			<div className='flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4'>
				<div>
					<h1 className='text-2xl font-semibold text-white'>
						Дыхательные практики
					</h1>
					<p className='mt-1 text-xs text-white/50'>
						Осознанное дыхание для концентрации, ясности ума и восстановления баланса
					</p>
				</div>
				{todayTotalMinutes > 0 && (
					<div className='text-xs text-white/50 font-mono'>
						Сегодня: <strong className='text-white/80'>{todayTotalMinutes} мин</strong>
					</div>
				)}
			</div>

			{/* MOBILE-ONLY: Horizontal quick-picker without vertical scrollbar */}
			<div className='mt-3 lg:hidden overflow-hidden'>
				<div className='flex gap-2 overflow-x-auto overflow-y-hidden touch-pan-x scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1'>
					{BREATHING_TECHNIQUES.map(tech => {
						const isSelected = tech.id === selectedTechnique.id
						return (
							<button
								key={tech.id}
								type='button'
								onClick={() => selectTechnique(tech)}
								className={`flex shrink-0 items-center px-3 py-1.5 text-xs transition-colors border ${
									isSelected
										? 'border-primary bg-primary/20 text-white font-medium'
										: 'border-white/10 bg-[#131417] text-white/60 hover:text-white'
								}`}
							>
								<span>{tech.shortName || tech.name.split('(')[0]}</span>
							</button>
						)
					})}
				</div>
			</div>

			{/* Responsive 2-Column Grid on Desktop */}
			<div className='mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start'>
				{/* MAIN / LEFT COLUMN: Visualizer Stage (lg:col-span-8) */}
				<div className='flex flex-col lg:col-span-8'>
					{/* Interactive Breathing Stage - Stable fixed desktop height */}
					<div className='relative flex flex-col justify-between border border-white/[0.08] bg-[#111215] p-5 sm:p-6 shadow-xl lg:h-[570px] min-h-[570px] overflow-hidden'>
						{/* Slot 1: Top Bar - Responsive layout preventing collisions on mobile */}
						<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3 shrink-0 min-h-[44px]'>
							<div className='flex items-center min-w-0'>
								<span className='text-sm sm:text-base font-medium text-white tracking-wide truncate'>
									{selectedTechnique.name}
								</span>
							</div>

							{/* Feedback & Mode Controls */}
							<div className='flex items-center gap-1.5 shrink-0 self-end sm:self-auto'>
								{/* Zen Mode Button */}
								<button
									type='button'
									onClick={toggleZenMode}
									title='Полноэкранный дзен-режим (Esc)'
									className='flex h-8 items-center gap-1.5 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 px-2.5 text-xs text-white/70 transition-colors'
								>
									<Maximize2 size={13} className='text-primary' />
									<span className='inline sm:inline'>Дзен</span>
								</button>

								{/* Audio & Soundscape Settings Button */}
								<button
									type='button'
									onClick={() => setIsAudioSettingsOpen(true)}
									title='Настройки звука и природы'
									className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs transition-colors ${
										soundscape !== 'none'
											? 'border-primary/50 bg-primary/15 text-primary font-medium'
											: 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/20'
									}`}
								>
									<Headphones size={13} />
									<span className='hidden sm:inline'>
										{soundscape === 'none'
											? 'Звук'
											: SOUNDSCAPE_OPTIONS.find(s => s.id === soundscape)?.label.split(' ')[0]}
									</span>
								</button>

								{/* Vibration Toggle */}
								<button
									type='button'
									onClick={toggleVibration}
									title={vibrationEnabled ? 'Вибрация включена' : 'Вибрация выключена'}
									className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs transition-colors ${
										vibrationEnabled
											? 'border-primary/50 bg-primary/15 text-primary font-medium'
											: 'border-white/10 bg-transparent text-white/40 hover:text-white hover:border-white/20'
									}`}
								>
									<Smartphone size={13} />
									<span className='hidden sm:inline'>Вибро</span>
								</button>

								{/* Quick Sound Mute Toggle */}
								<button
									type='button'
									onClick={toggleSound}
									title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
									className={`flex h-8 w-8 items-center justify-center border text-xs transition-colors ${
										soundEnabled
											? 'border-primary/50 bg-primary/15 text-primary'
											: 'border-white/10 bg-transparent text-white/40 hover:text-white hover:border-white/20'
									}`}
								>
									{soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
								</button>
							</div>
						</div>

						{/* Slot 2 & 3: Visualizer and Flow Stepper */}
						<div className='flex-1 flex flex-col items-center justify-center relative py-1 min-h-0'>
							<BreathingCircle
								technique={selectedTechnique}
								currentPhase={currentPhase}
								currentPhaseIndex={currentPhaseIndex}
								phaseRemainingSeconds={phaseRemainingSeconds}
								phaseProgress={phaseProgress}
								isActive={isActive}
								isPaused={isPaused}
								cycleCount={completedCycles}
							/>
						</div>

						{/* Slot 4: Duration / Status & Action Buttons - Responsive */}
						<div className='relative shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/[0.06] pt-4 w-full'>
							{/* Top edge luminous session progress indicator */}
							{isActive && targetDurationSeconds > 0 && (
								<div className='absolute top-0 left-0 h-[2px] w-full bg-white/[0.05] overflow-hidden'>
									<div
										className='h-full bg-gradient-to-r from-primary to-purple-400 transition-all duration-300 ease-linear shadow-[0_0_8px_rgba(139,92,246,0.6)]'
										style={{
											width: `${Math.min(100, (totalElapsedSeconds / targetDurationSeconds) * 100)}%`
										}}
									/>
								</div>
							)}

							{/* Left: Duration Selector (opens modal window) or Active Stopwatch Timer */}
							{!isActive ? (
								<button
									type='button'
									onClick={() => setIsDurationModalOpen(true)}
									className='flex h-9 items-center justify-between sm:justify-start gap-2 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 px-3.5 py-1 text-xs text-white/85 transition-colors w-full sm:w-auto shrink-0'
									title='Выбрать время сеанса в отдельном окне'
								>
									<div className='flex items-center gap-2'>
										<Clock size={13} className='text-primary' />
										<span className='text-white/45 font-mono'>Время:</span>
										<span className='font-medium text-white'>
											{targetDurationSeconds > 0
												? `${Math.round(targetDurationSeconds / 60)} мин`
												: 'Без лимита'}
										</span>
									</div>
									<ChevronDown size={12} className='text-white/40 ml-1' />
								</button>
							) : (
								<div className='flex items-baseline gap-1.5 font-mono whitespace-nowrap shrink-0'>
									<span className='text-base sm:text-lg font-semibold text-white tracking-tight'>
										{formatTime(totalElapsedSeconds)}
									</span>
									{targetDurationSeconds > 0 && (
										<span className='text-xs text-white/40 font-normal'>
											/ {formatTime(targetDurationSeconds)}
										</span>
									)}
								</div>
							)}

							{/* Right: Action Buttons */}
							<div className='flex items-center gap-2 w-full sm:w-auto'>
								{!isActive ? (
									<button
										type='button'
										onClick={startSession}
										className='flex h-9 items-center justify-center gap-2 border border-primary bg-primary px-6 text-xs sm:text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary/90 w-full sm:w-auto'
									>
										<Play size={13} fill='currentColor' />
										<span>Начать практику</span>
									</button>
								) : (
									<>
										{isPaused ? (
											<button
												type='button'
												onClick={resumeSession}
												className='flex-1 sm:flex-initial flex h-9 items-center justify-center gap-1.5 sm:gap-2 border border-primary bg-primary px-3 sm:px-5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 shadow-sm'
											>
												<Play size={13} fill='currentColor' />
												<span>Продолжить</span>
											</button>
										) : (
											<button
												type='button'
												onClick={pauseSession}
												className='flex-1 sm:flex-initial flex h-9 items-center justify-center gap-1.5 sm:gap-2 border border-white/20 bg-white/10 px-3 sm:px-5 text-xs font-medium text-white transition-colors hover:bg-white/15'
											>
												<Pause size={13} />
												<span>Пауза</span>
											</button>
										)}

										<button
											type='button'
											onClick={finishSession}
											className='flex-1 sm:flex-initial flex h-9 items-center justify-center gap-1.5 sm:gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 sm:px-4 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20'
										>
											<Check size={13} />
											<span>Завершить</span>
										</button>

										<button
											type='button'
											onClick={resetSession}
											title='Сбросить'
											className='grid h-9 w-9 shrink-0 place-items-center border border-white/10 bg-transparent text-white/40 hover:border-white/25 hover:text-white transition-colors'
										>
											<RotateCcw size={13} />
										</button>
									</>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* SIDEBAR / RIGHT COLUMN: Catalog of Techniques & History (lg:col-span-4) */}
				<div
					className={`flex flex-col lg:col-span-4 transition-opacity duration-500 ease-in-out ${
						isActive ? 'opacity-40 pointer-events-none' : 'opacity-100'
					}`}
				>
					<div className='border border-white/[0.08] bg-[#111215] p-4 shadow-xl lg:h-[570px] flex flex-col'>
						{/* Tab Navigation Header */}
						<div className='flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0'>
							<div className='flex items-center gap-1 bg-white/[0.03] p-0.5 border border-white/[0.08]'>
								<button
									type='button'
									onClick={() => setSidebarTab('catalog')}
									className={`px-3 py-1 text-xs transition-colors font-medium ${
										sidebarTab === 'catalog'
											? 'bg-primary text-white shadow-sm'
											: 'text-white/60 hover:text-white'
									}`}
								>
									Каталог
								</button>
								<button
									type='button'
									onClick={() => setSidebarTab('history')}
									className={`flex items-center gap-1.5 px-3 py-1 text-xs transition-colors font-medium ${
										sidebarTab === 'history'
											? 'bg-primary text-white shadow-sm'
											: 'text-white/60 hover:text-white'
									}`}
								>
									<span>История</span>
									{sessions.length > 0 && (
										<span
											className={`px-1.5 py-0.2 text-[10px] font-mono ${
												sidebarTab === 'history'
													? 'bg-white/20 text-white'
													: 'bg-white/10 text-white/60'
											}`}
										>
											{sessions.length}
										</span>
									)}
								</button>
							</div>

							{sidebarTab === 'history' && (
								<span className='text-[11px] text-white/40 font-mono'>
									{todayTotalMinutes > 0
										? `сегодня ${todayTotalMinutes} мин`
										: `${sessions.length} сеансов`}
								</span>
							)}
						</div>

						{/* Tab Content: Catalog View (Clean list without duplicate bottom history button) */}
						{sidebarTab === 'catalog' && (
							<div className='flex-1 overflow-y-auto pr-1 divide-y divide-white/[0.04] pt-1'>
								{BREATHING_TECHNIQUES.map(tech => {
									const isSelected = tech.id === selectedTechnique.id
									return (
										<button
											key={tech.id}
											type='button'
											onClick={() => selectTechnique(tech)}
											className={`group w-full flex items-start py-3 px-3 text-left transition-colors ${
												isSelected
													? 'bg-white/[0.04] border-l-2 border-primary -ml-[1px]'
													: 'hover:bg-white/[0.015] border-l-2 border-transparent'
											}`}
										>
											<div className='min-w-0 flex-1'>
												<div className='flex items-center justify-between gap-2'>
													<span
														className={`text-xs transition-colors truncate ${
															isSelected
																? 'font-semibold text-white'
																: 'font-medium text-white/70 group-hover:text-white'
														}`}
														style={{ color: isSelected ? tech.accentColor : undefined }}
													>
														{tech.name}
													</span>
													<span className='text-[11px] font-mono text-white/40 shrink-0'>
														{tech.totalCycleSeconds}с
													</span>
												</div>
												<p className='mt-1 text-[11px] text-white/45 leading-relaxed line-clamp-2'>
													{tech.description}
												</p>
											</div>
										</button>
									)
								})}
							</div>
						)}

						{/* Tab Content: History View */}
						{sidebarTab === 'history' && (
							<div className='flex-1 flex flex-col justify-between overflow-hidden pt-2'>
								<div className='flex-1 overflow-y-auto pr-1'>
									{loadingHistory ? (
										<p className='py-8 text-center text-xs text-white/40'>
											Загружаем историю…
										</p>
									) : sessions.length === 0 ? (
										<div className='py-12 px-4 text-center'>
											<History size={24} className='mx-auto text-white/20 mb-2' />
											<p className='text-xs text-white/50 font-medium'>
												История пока пуста
											</p>
											<p className='text-[11px] text-white/35 mt-1 leading-relaxed'>
												Сеансы сохраняются автоматически после завершения практики.
											</p>
										</div>
									) : (
										<div className='divide-y divide-white/[0.04]'>
											{sessions.map(s => (
												<div
													key={s.id}
													className='group flex items-center justify-between py-2.5 px-2 text-xs transition-colors hover:bg-white/[0.02]'
												>
													<div className='min-w-0 flex-1 pr-2'>
														<p className='truncate font-medium text-white/85'>
															{s.technique_name}
														</p>
														<p className='text-[10px] text-white/35 mt-0.5'>
															{new Date(s.created_at).toLocaleDateString('ru-RU', {
																day: 'numeric',
																month: 'short',
																hour: '2-digit',
																minute: '2-digit'
															})}
														</p>
													</div>

													<div className='flex items-center gap-2.5 shrink-0'>
														<div className='text-right font-mono text-[11px] text-white/60'>
															<div>{Math.round(s.duration_seconds / 60) || 1} мин</div>
															<div className='text-[10px] text-white/30'>
																{s.cycles_count} ц.
															</div>
														</div>

														<button
															type='button'
															onClick={() => setSessionToDelete(s)}
															title='Удалить запись'
															className='grid h-6 w-6 place-items-center border border-transparent text-white/25 hover:border-red-500/20 hover:text-red-400 transition-colors'
														>
															<Trash2 size={12} />
														</button>
													</div>
												</div>
											))}
										</div>
									)}
								</div>

								{/* Bottom Quick Return to Catalog */}
								<div className='pt-2.5 mt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-white/50 shrink-0'>
									<button
										type='button'
										onClick={() => setSidebarTab('catalog')}
										className='text-primary hover:underline text-xs font-medium'
									>
										← К каталогу практик
									</button>
									<span className='text-[11px] text-white/35 font-mono'>
										Всего: {sessions.length}
									</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ========================================================================= */}
			{/* FULLSCREEN ZEN MODE OVERLAY                                               */}
			{/* ========================================================================= */}
			{isZenMode && (
				<div className='fixed inset-0 z-[120] flex flex-col justify-between bg-[#08090b] p-6 sm:p-10 select-none overflow-hidden'>
					{/* Deep Graphite Ambient Backdrop with Subtle Vignette */}
					<div
						className='absolute inset-0 pointer-events-none'
						style={{
							background:
								'radial-gradient(ellipse 90% 80% at 50% 50%, #0d0e12 0%, #08090b 100%)'
						}}
					/>

					{/* Zen Header */}
					<div className='relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-4'>
						<div>
							<h2 className='text-base font-medium text-white'>
								{selectedTechnique.name}
							</h2>
							<p className='text-xs text-white/40 font-mono mt-0.5'>
								{isActive ? (
									<>
										Время: <strong className='text-white'>{formatTime(totalElapsedSeconds)}</strong>
										{targetDurationSeconds > 0 && ` / ${formatTime(targetDurationSeconds)}`}
									</>
								) : (
									<>
										<span>Длительность: </span>
										<button
											type='button'
											onClick={() => setIsDurationModalOpen(true)}
											className='text-white underline decoration-dotted hover:text-primary transition-colors'
											title='Выбрать время сеанса'
										>
											{targetDurationSeconds > 0
												? `${Math.round(targetDurationSeconds / 60)} мин`
												: 'Без лимита'}
										</button>
									</>
								)}
							</p>
						</div>

						{/* Quick Zen Actions */}
						<div className='flex items-center gap-2'>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(true)}
								title='Настройки звука и фона природы'
								className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs transition-colors ${
									soundscape !== 'none' || soundEnabled
										? 'border-primary/50 bg-primary/15 text-primary font-medium'
										: 'border-white/10 bg-white/[0.04] text-white/50 hover:text-white'
								}`}
							>
								<Headphones size={13} />
								<span className='hidden sm:inline'>
									{soundscape === 'none'
										? 'Звук'
										: SOUNDSCAPE_OPTIONS.find(s => s.id === soundscape)?.label}
								</span>
							</button>

							<button
								type='button'
								onClick={toggleVibration}
								title={vibrationEnabled ? 'Вибрация включена' : 'Вибрация выключена'}
								className={`flex h-8 w-8 items-center justify-center border text-xs transition-colors ${
									vibrationEnabled
										? 'border-primary/50 bg-primary/15 text-primary'
										: 'border-white/10 bg-white/[0.04] text-white/40 hover:text-white'
								}`}
							>
								<Smartphone size={13} />
							</button>

							<button
								type='button'
								onClick={toggleZenMode}
								title='Выйти из дзен-режима (Esc)'
								className='flex h-8 items-center gap-1.5 border border-white/20 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/15'
							>
								<Minimize2 size={13} />
								<span className='hidden sm:inline'>Выход (Esc)</span>
							</button>
						</div>
					</div>

					{/* Zen Center: Instruction ABOVE the breathing form + Visualizer Circle */}
					<div className='relative z-10 flex flex-1 flex-col items-center justify-center py-2'>
						{/* Phase instruction hint ABOVE the central form */}
						<div className='min-h-[32px] w-full max-w-sm sm:max-w-md px-4 shrink-0 flex items-center justify-center mb-4 sm:mb-6 min-w-0'>
							<p className='text-xs sm:text-base font-medium text-white/85 tracking-wide text-center leading-relaxed break-words line-clamp-2 transition-opacity duration-300'>
								{isActive
									? (isPaused ? 'Пауза' : currentPhase.hint)
									: selectedTechnique.tagline}
							</p>
						</div>

						<BreathingCircle
							technique={selectedTechnique}
							currentPhase={currentPhase}
							currentPhaseIndex={currentPhaseIndex}
							phaseRemainingSeconds={phaseRemainingSeconds}
							phaseProgress={phaseProgress}
							isActive={isActive}
							isPaused={isPaused}
							cycleCount={completedCycles}
							isZen={true}
						/>
					</div>

					{/* Zen Bottom Controls */}
					<div className='relative z-10 flex flex-col items-center gap-3 border-t border-white/[0.06] pt-4'>
						<div className='flex flex-wrap items-center justify-center gap-3'>
							{!isActive ? (
								<div className='flex items-center gap-3'>
									<button
										type='button'
										onClick={() => setIsDurationModalOpen(true)}
										className='flex h-10 items-center gap-2 border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 px-4 text-xs font-medium text-white/85 transition-colors'
										title='Выбрать время сеанса'
									>
										<Clock size={14} className='text-primary' />
										<span className='font-mono text-white/45'>Время:</span>
										<span className='text-white font-medium'>
											{targetDurationSeconds > 0
												? `${Math.round(targetDurationSeconds / 60)} мин`
												: 'Без лимита'}
										</span>
										<ChevronDown size={12} className='text-white/40 ml-0.5' />
									</button>

									<button
										type='button'
										onClick={startSession}
										className='flex h-10 items-center gap-2 border border-primary bg-primary px-7 text-xs sm:text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary/90'
									>
										<Play size={15} fill='currentColor' />
										<span>Начать практику</span>
									</button>
								</div>
							) : (
								<div className='flex items-center gap-2.5'>
									{isPaused ? (
										<button
											type='button'
											onClick={resumeSession}
											className='flex h-10 items-center gap-2 border border-primary bg-primary px-6 text-xs font-semibold text-white transition-colors hover:bg-primary/90'
										>
											<Play size={14} fill='currentColor' />
											<span>Продолжить</span>
										</button>
									) : (
										<button
											type='button'
											onClick={pauseSession}
											className='flex h-10 items-center gap-2 border border-white/20 bg-white/10 px-6 text-xs font-medium text-white transition-colors hover:bg-white/15'
										>
											<Pause size={14} />
											<span>Пауза</span>
										</button>
									)}

									<button
										type='button'
										onClick={finishSession}
										className='flex h-10 items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20'
									>
										<Check size={14} />
										<span>Завершить и сохранить</span>
									</button>

									<button
										type='button'
										onClick={resetSession}
										title='Сбросить'
										className='grid h-10 w-10 place-items-center border border-white/10 bg-transparent text-white/40 hover:border-white/25 hover:text-white transition-colors'
									>
										<RotateCcw size={14} />
									</button>
								</div>
							)}
						</div>

						<p className='text-[11px] text-white/30'>
							Нажмите клавишу Esc или кнопку «Выход», чтобы вернуться.
						</p>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* AUDIO & SOUNDSCAPES SETTINGS MODAL                                        */}
			{/* ========================================================================= */}
			{isAudioSettingsOpen && (
				<div
					className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
					onMouseDown={e => {
						if (e.target === e.currentTarget) setIsAudioSettingsOpen(false)
					}}
				>
					<div className='w-full max-w-lg border border-white/10 bg-[#121316] p-5 sm:p-6 shadow-2xl'>
						{/* Modal Header */}
						<div className='flex items-center justify-between border-b border-white/10 pb-4'>
							<div>
								<h3 className='text-sm sm:text-base font-semibold text-white'>
									Звуковое окружение
								</h3>
								<p className='text-xs text-white/50 mt-0.5'>
									Настройте фоны природы и звуковые сигналы фаз
								</p>
							</div>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(false)}
								className='text-white/40 hover:text-white transition-colors'
							>
								<X size={18} />
							</button>
						</div>

						{/* Section 1: Soundscapes */}
						<div className='mt-5'>
							<div className='flex items-center justify-between'>
								<label className='text-xs font-semibold uppercase tracking-wider text-white/60'>
									Фоновые звуки природы
								</label>
								<span className='text-xs text-primary font-medium'>
									{SOUNDSCAPE_OPTIONS.find(s => s.id === soundscape)?.label}
								</span>
							</div>

							<div className='mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2'>
								{SOUNDSCAPE_OPTIONS.map(opt => {
									const isSelected = soundscape === opt.id
									const IconComp = getSoundscapeIcon(opt.id)
									return (
										<button
											key={opt.id}
											type='button'
											onClick={() => handleSoundscapeChange(opt.id)}
											className={`flex flex-col items-start gap-1 border p-2.5 text-left transition-colors ${
												isSelected
													? 'border-primary bg-primary/15 text-white'
													: 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white hover:bg-white/[0.04]'
											}`}
										>
											<div className='flex items-center gap-1.5'>
												<IconComp
													size={14}
													className={isSelected ? 'text-primary' : 'text-white/45'}
												/>
												<span className='text-xs font-medium'>{opt.label}</span>
											</div>
											<span className='text-[10px] text-white/40 line-clamp-1'>
												{opt.description}
											</span>
										</button>
									)
								})}
							</div>

							{/* Soundscape Volume */}
							{soundscape !== 'none' && (
								<div className='mt-3.5 flex items-center gap-3 px-1 py-1'>
									<Volume2 size={14} className='text-white/40 shrink-0' />
									<span className='text-xs text-white/60 shrink-0'>Громкость фона:</span>
									<input
										type='range'
										min={0}
										max={100}
										value={soundscapeVolume}
										onChange={e => handleSoundscapeVolumeChange(Number(e.target.value))}
										className='h-1.5 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
									/>
									<span className='w-8 text-right font-mono text-xs text-white/50'>
										{soundscapeVolume}%
									</span>
								</div>
							)}
						</div>

						{/* Section 2: Cue Styles */}
						<div className='mt-5 border-t border-white/[0.08] pt-4'>
							<div className='flex items-center justify-between'>
								<label className='text-xs font-semibold uppercase tracking-wider text-white/60'>
									Сигнал смены фазы
								</label>
								<button
									type='button'
									onClick={() => breathingAudio.playTone('inhale')}
									className='flex items-center gap-1 text-[11px] text-primary hover:underline'
								>
									<Play size={11} fill='currentColor' />
									<span>Проверить звук</span>
								</button>
							</div>

							<div className='mt-2.5 grid grid-cols-2 gap-2'>
								{CUE_STYLE_OPTIONS.map(opt => {
									const isSelected = cueStyle === opt.id
									return (
										<button
											key={opt.id}
											type='button'
											onClick={() => handleCueStyleChange(opt.id)}
											className={`flex flex-col items-start gap-0.5 border p-2.5 text-left transition-colors ${
												isSelected
													? 'border-primary bg-primary/15 text-white'
													: 'border-white/[0.08] bg-white/[0.02] text-white/70 hover:border-white/20 hover:text-white hover:bg-white/[0.04]'
											}`}
										>
											<div className='flex items-center gap-1.5'>
												{opt.id === 'tibetan' && <Sparkles size={13} className='text-amber-400' />}
												{opt.id === 'bell' && <Bell size={13} className='text-sky-400' />}
												{opt.id === 'soft_sine' && <Activity size={13} className='text-emerald-400' />}
												{opt.id === 'none' && <VolumeX size={13} className='text-white/40' />}
												<span className='text-xs font-medium'>{opt.label}</span>
											</div>
											<span className='text-[10px] text-white/40'>
												{opt.description}
											</span>
										</button>
									)
								})}
							</div>

							{/* Cue Volume */}
							{cueStyle !== 'none' && (
								<div className='mt-3.5 flex items-center gap-3 px-1 py-1'>
									<Bell size={14} className='text-white/40 shrink-0' />
									<span className='text-xs text-white/60 shrink-0'>Громкость сигнала:</span>
									<input
										type='range'
										min={0}
										max={100}
										value={cueVolume}
										onChange={e => handleCueVolumeChange(Number(e.target.value))}
										className='h-1.5 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
									/>
									<span className='w-8 text-right font-mono text-xs text-white/50'>
										{cueVolume}%
									</span>
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='mt-5 flex justify-end border-t border-white/10 pt-4'>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(false)}
								className='border border-primary bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90'
							>
								Применить и закрыть
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ========================================================================= */}
			{/* DURATION SELECTION MODAL ("Отдельное окошко выбора времени сеанса")        */}
			{/* ========================================================================= */}
			{isDurationModalOpen && (
				<div
					className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
					onMouseDown={e => {
						if (e.target === e.currentTarget) setIsDurationModalOpen(false)
					}}
				>
					<div className='w-full max-w-md border border-white/10 bg-[#121316] p-5 sm:p-6 shadow-2xl'>
						{/* Modal Header */}
						<div className='flex items-center justify-between border-b border-white/10 pb-4'>
							<div>
								<h3 className='text-sm sm:text-base font-semibold text-white'>
									Время сеанса
								</h3>
								<p className='mt-0.5 text-xs text-white/50'>
									Выберите целевую длительность дыхательной практики
								</p>
							</div>
							<button
								type='button'
								onClick={() => setIsDurationModalOpen(false)}
								className='text-white/40 hover:text-white p-1 transition-colors'
								title='Закрыть'
							>
								<X size={18} />
							</button>
						</div>

						{/* Durations Grid / List */}
						<div className='mt-4 space-y-2'>
							{DURATIONS.map(dur => {
								const isSelected = targetDurationSeconds === dur.seconds
								return (
									<button
										key={dur.seconds}
										type='button'
										onClick={() => {
											setTargetDurationSeconds(dur.seconds)
											setIsDurationModalOpen(false)
										}}
										className={`w-full flex items-center justify-between p-3 text-left transition-all border ${
											isSelected
												? 'border-primary bg-primary/15 text-white'
												: 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 text-white/70'
										}`}
									>
										<div className='min-w-0'>
											<span className='font-semibold text-sm text-white block'>
												{dur.label}
											</span>
											{dur.description && (
												<p className='mt-0.5 text-xs text-white/45'>
													{dur.description}
												</p>
											)}
										</div>

										<div className='shrink-0 ml-3'>
											{isSelected ? (
												<div className='h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white'>
													<Check size={12} strokeWidth={3} />
												</div>
											) : (
												<div className='h-5 w-5 rounded-full border border-white/20' />
											)}
										</div>
									</button>
								)
							})}
						</div>

						{/* Modal Footer */}
						<div className='mt-5 pt-3 border-t border-white/[0.08] flex justify-end'>
							<button
								type='button'
								onClick={() => setIsDurationModalOpen(false)}
								className='border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs text-white hover:bg-white/10 transition-colors'
							>
								Закрыть
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Confirm Dialog for deleting session */}
			{sessionToDelete && (
				<ConfirmDialog
					open={Boolean(sessionToDelete)}
					title='Удалить сеанс дыхания?'
					description={`Запись «${sessionToDelete.technique_name}» (${Math.round(sessionToDelete.duration_seconds / 60) || 1} мин, ${sessionToDelete.cycles_count} ц.) будет безвозвратно удалена из истории.`}
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
