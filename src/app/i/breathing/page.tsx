'use client'

import {
	Activity,
	Bell,
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	CloudRain,
	Flame,
	Headphones,
	History,
	Maximize2,
	Minimize2,
	Moon,
	Pause,
	Play,
	Radio,
	RotateCcw,
	Smartphone,
	Sparkles,
	Square,
	Trash2,
	Trees,
	Volume2,
	VolumeX,
	Waves,
	X,
	Zap
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

const DURATIONS = [
	{ label: '1 мин', seconds: 60 },
	{ label: '2 мин', seconds: 120 },
	{ label: '3 мин', seconds: 180 },
	{ label: '5 мин', seconds: 300 },
	{ label: '10 мин', seconds: 600 },
	{ label: 'Без лимита', seconds: 0 }
]

export default function BreathingPage() {
	const [selectedTechnique, setSelectedTechnique] = useState<IBreathingTechnique>(
		BREATHING_TECHNIQUES[0]
	)
	const [targetDurationSeconds, setTargetDurationSeconds] = useState<number>(180) // 3 min default
	const [isActive, setIsActive] = useState<boolean>(false)
	const [isPaused, setIsPaused] = useState<boolean>(false)

	// Zen Mode & Audio Settings Modal
	const [isZenMode, setIsZenMode] = useState<boolean>(false)
	const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState<boolean>(false)
	const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)

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

	// Escape key listener for Zen Mode
	useEffect(() => {
		if (!isZenMode) return
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setIsZenMode(false)
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [isZenMode])

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
		<div className='w-full pb-20'>
			{/* Page Editorial Header */}
			<div className='flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] pb-5'>
				<div>
					<h1 className='text-2xl sm:text-3xl font-light tracking-tight text-white'>
						Дыхательные практики
					</h1>
					<p className='mt-1 text-xs sm:text-sm text-white/50'>
						Осознанное дыхание для ясности ума, спокойствия и восстановления баланса
					</p>
				</div>
				{todayTotalMinutes > 0 && (
					<div className='flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1.5 text-xs text-violet-200'>
						<Sparkles size={13} className='text-violet-400' />
						<span>
							Сегодня: <strong className='text-white'>{todayTotalMinutes} мин</strong> практики
						</span>
					</div>
				)}
			</div>

			{/* MOBILE-ONLY: Horizontal quick-picker */}
			<div className='mt-5 lg:hidden'>
				<label className='text-[11px] font-semibold uppercase tracking-wider text-white/40'>
					Практика:
				</label>
				<div className='mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none'>
					{BREATHING_TECHNIQUES.map(tech => {
						const isSelected = tech.id === selectedTechnique.id
						return (
							<button
								key={tech.id}
								type='button'
								onClick={() => selectTechnique(tech)}
								className={`flex shrink-0 items-center rounded-full px-4 py-2 text-xs font-medium transition-all ${
									isSelected
										? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
										: 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
								}`}
							>
								<span>{tech.shortName || tech.name.split('(')[0]}</span>
							</button>
						)
					})}
				</div>
			</div>

			{/* Responsive 2-Column Grid on Desktop */}
			<div className='mt-6 grid grid-cols-1 gap-7 lg:grid-cols-12 items-start'>
				{/* MAIN / LEFT COLUMN: Visualizer Stage & Primary Experience (lg:col-span-8) */}
				<div className='flex flex-col gap-6 lg:col-span-8'>
					{/* Interactive Breathing Stage */}
					<div className='relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#13141a]/95 via-[#0e0f13]/95 to-[#0a0b0e]/95 p-6 sm:p-10 shadow-2xl backdrop-blur-md'>
						{/* Ambient Atmospheric Glow at Stage Top */}
						<div
							className='pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[130px] transition-all duration-1000'
							style={{
								backgroundColor: selectedTechnique.accentColor,
								opacity: isActive ? 0.18 : 0.08
							}}
						/>

						{/* Top Bar with technique name, timer & quick toggles */}
						<div className='relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-5'>
							<div className='flex items-center gap-3.5'>
								<span className='text-base sm:text-lg font-medium text-white tracking-wide'>
									{selectedTechnique.name}
								</span>
								<div className='h-3 w-px bg-white/15' />
								<div className='flex items-center gap-3 text-xs font-mono text-white/50'>
									<span className='flex items-center gap-1.5'>
										<Clock size={13} className='text-white/40' />
										<strong className='text-white/90'>{formatTime(totalElapsedSeconds)}</strong>
										{targetDurationSeconds > 0 && ` / ${formatTime(targetDurationSeconds)}`}
									</span>
									<span>
										Цикл: <strong className='text-white/90'>{completedCycles + 1}</strong>
									</span>
								</div>
							</div>

							{/* Feedback & Mode Quick Pill Toggles */}
							<div className='flex items-center gap-1.5 sm:gap-2'>
								{/* Zen Mode Button */}
								<button
									type='button'
									onClick={toggleZenMode}
									title='Полноэкранный дзен-режим (Esc)'
									className='flex h-8 items-center gap-1.5 rounded-full bg-white/[0.04] px-3 text-xs text-white/70 transition-colors hover:bg-violet-500/15 hover:text-white'
								>
									<Maximize2 size={13} className='text-violet-400' />
									<span className='hidden sm:inline'>Дзен</span>
								</button>

								{/* Audio & Soundscape Settings Button */}
								<button
									type='button'
									onClick={() => setIsAudioSettingsOpen(true)}
									title='Настройки звука и природы'
									className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors ${
										soundscape !== 'none'
											? 'bg-violet-500/20 text-violet-300 font-medium'
											: 'bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]'
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
									className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition-colors ${
										vibrationEnabled
											? 'bg-violet-500/20 text-violet-300 font-medium'
											: 'bg-white/[0.03] text-white/40 hover:text-white'
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
									className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
										soundEnabled
											? 'bg-violet-500/20 text-violet-300'
											: 'bg-white/[0.03] text-white/40 hover:text-white'
									}`}
								>
									{soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
								</button>
							</div>
						</div>

						{/* Hero Visualizer Orb */}
						<div className='relative z-10'>
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

						{/* Duration Segmented Pill Selector (Visible when Idle) */}
						{!isActive && (
							<div className='relative z-10 mt-5 flex flex-col items-center gap-2'>
								<span className='text-[10px] uppercase tracking-widest text-white/40 font-mono'>
									Длительность практики
								</span>
								<div className='inline-flex items-center rounded-full border border-white/[0.06] bg-[#0c0d11]/80 p-1 backdrop-blur-md'>
									{DURATIONS.map(dur => {
										const isSelected = targetDurationSeconds === dur.seconds
										return (
											<button
												key={dur.seconds}
												type='button'
												onClick={() => setTargetDurationSeconds(dur.seconds)}
												className={`rounded-full px-3.5 py-1.5 text-xs transition-all duration-200 ${
													isSelected
														? 'bg-violet-600/35 text-white font-medium shadow-sm border border-violet-500/40'
														: 'text-white/50 hover:text-white/80'
												}`}
											>
												{dur.label}
											</button>
										)
									})}
								</div>
							</div>
						)}

						{/* Action Buttons */}
						<div className='relative z-10 mt-6 flex flex-wrap items-center justify-center gap-3.5 pt-2'>
							{!isActive ? (
								<button
									type='button'
									onClick={startSession}
									className='group flex h-12 items-center gap-3 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-9 text-sm font-medium text-white shadow-xl shadow-violet-600/25 transition-all duration-200 hover:shadow-violet-600/40 hover:scale-[1.02] active:scale-[0.98]'
								>
									<Play size={16} fill='currentColor' className='transition-transform group-hover:scale-110' />
									<span>Начать практику</span>
								</button>
							) : (
								<div className='flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#0c0d11]/80 p-1.5 backdrop-blur-md shadow-2xl'>
									{isPaused ? (
										<button
											type='button'
											onClick={resumeSession}
											className='flex h-11 items-center gap-2 rounded-full bg-violet-600 px-7 text-xs font-semibold text-white shadow-lg transition-all hover:bg-violet-500'
										>
											<Play size={15} fill='currentColor' />
											<span>Продолжить</span>
										</button>
									) : (
										<button
											type='button'
											onClick={pauseSession}
											className='flex h-11 items-center gap-2 rounded-full bg-white/[0.08] px-7 text-xs font-medium text-white transition-colors hover:bg-white/[0.14]'
										>
											<Pause size={15} />
											<span>Пауза</span>
										</button>
									)}

									<button
										type='button'
										onClick={finishSession}
										className='flex h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20'
									>
										<Check size={15} />
										<span>Завершить</span>
									</button>

									<button
										type='button'
										onClick={resetSession}
										title='Сбросить'
										className='flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white'
									>
										<RotateCcw size={15} />
									</button>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* SIDEBAR / RIGHT COLUMN: Techniques list & Collapsible History (lg:col-span-4) */}
				<div
					className={`flex flex-col gap-5 lg:col-span-4 transition-all duration-700 ${
						isActive ? 'opacity-30 pointer-events-none' : 'opacity-100'
					}`}
				>
					{/* Technique Selection List */}
					<div className='rounded-3xl border border-white/[0.06] bg-[#121318]/70 p-5 backdrop-blur-sm shadow-xl'>
						<div className='flex items-center justify-between border-b border-white/[0.06] pb-3'>
							<span className='text-xs font-semibold uppercase tracking-wider text-white/50'>
								Техники дыхания
							</span>
							<span className='text-[11px] text-white/40 font-mono'>
								{BREATHING_TECHNIQUES.length} практик
							</span>
						</div>

						<div className='mt-3 flex flex-col gap-1.5'>
							{BREATHING_TECHNIQUES.map(tech => {
								const isSelected = tech.id === selectedTechnique.id
								const IconComp = tech.icon
								return (
									<button
										key={tech.id}
										type='button'
										onClick={() => selectTechnique(tech)}
										className={`group relative flex items-start gap-3.5 rounded-2xl p-3 text-left transition-all duration-200 ${
											isSelected
												? 'bg-white/[0.08] text-white shadow-md'
												: 'bg-transparent text-white/70 hover:bg-white/[0.03] hover:text-white'
										}`}
									>
										{/* Active Accent Icon Pill */}
										<div
											className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
												isSelected
													? 'bg-violet-500/20 text-violet-300'
													: 'bg-white/[0.04] text-white/40 group-hover:text-white/70'
											}`}
											style={{
												backgroundColor: isSelected ? `${tech.accentColor}25` : undefined,
												color: isSelected ? tech.accentColor : undefined
											}}
										>
											<IconComp size={16} />
										</div>

										<div className='min-w-0 flex-1'>
											<div className='flex items-center justify-between gap-2'>
												<span
													className='text-xs font-semibold truncate transition-colors'
													style={{
														color: isSelected ? tech.accentColor : undefined
													}}
												>
													{tech.name}
												</span>
												<span className='text-[10px] text-white/40 font-mono shrink-0'>
													{tech.totalCycleSeconds}с
												</span>
											</div>
											<p className='mt-0.5 line-clamp-1 text-[11px] text-white/50'>
												{tech.tagline}
											</p>
										</div>
									</button>
								)
							})}
						</div>
					</div>

					{/* Collapsible Session History Card */}
					<div className='rounded-3xl border border-white/[0.06] bg-[#121318]/70 p-5 backdrop-blur-sm shadow-xl'>
						<button
							type='button'
							onClick={() => setIsHistoryOpen(prev => !prev)}
							className='flex w-full items-center justify-between text-left'
						>
							<div className='flex items-center gap-2.5'>
								<History size={16} className='text-violet-400/80' />
								<div>
									<h3 className='text-xs font-semibold uppercase tracking-wider text-white/70'>
										История сеансов
									</h3>
									<p className='text-[11px] text-white/40 mt-0.5'>
										{sessions.length > 0
											? `${sessions.length} записей • сегодня ${todayTotalMinutes} мин`
											: 'Сеансы сохраняются автоматически'}
									</p>
								</div>
							</div>
							<div className='flex items-center gap-2'>
								<span className='rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] text-white/50 font-mono'>
									{sessions.length}
								</span>
								{isHistoryOpen ? (
									<ChevronUp size={16} className='text-white/40' />
								) : (
									<ChevronDown size={16} className='text-white/40' />
								)}
							</div>
						</button>

						{isHistoryOpen && (
							<div className='mt-4 border-t border-white/[0.06] pt-3'>
								{loadingHistory ? (
									<p className='py-4 text-center text-xs text-white/40'>
										Загружаем историю…
									</p>
								) : sessions.length === 0 ? (
									<p className='py-4 text-center text-xs text-white/40 leading-relaxed'>
										Сеансы сохраняются автоматически после завершения практики (от 15 сек или 1 цикла).
									</p>
								) : (
									<div className='divide-y divide-white/[0.04] max-h-[300px] overflow-y-auto pr-1'>
										{sessions.map(s => (
											<div
												key={s.id}
												className='group flex items-center justify-between py-2.5 text-xs transition-colors hover:bg-white/[0.02]'
											>
												<div className='min-w-0 flex-1 pr-2'>
													<p className='truncate font-medium text-white/90'>
														{s.technique_name}
													</p>
													<p className='text-[10px] text-white/40'>
														{new Date(s.created_at).toLocaleDateString('ru-RU', {
															day: 'numeric',
															month: 'short',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</p>
												</div>

												<div className='flex items-center gap-2 shrink-0'>
													<div className='text-right font-mono text-[11px] text-white/60'>
														<div>{Math.round(s.duration_seconds / 60) || 1} мин</div>
														<div className='text-[10px] text-white/40'>{s.cycles_count} ц.</div>
													</div>

													<button
														type='button'
														onClick={() => setSessionToDelete(s)}
														title='Удалить запись'
														className='ml-1 grid h-7 w-7 place-items-center rounded-lg text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors'
													>
														<Trash2 size={13} />
													</button>
												</div>
											</div>
										))}
									</div>
								)}
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
					{/* Ambient atmospheric radial glow */}
					<div
						className='pointer-events-none absolute inset-0 transition-all duration-1000'
						style={{
							background: `radial-gradient(circle at 50% 45%, ${selectedTechnique.accentColor}18 0%, rgba(8,9,11,0.98) 72%)`
						}}
					/>

					{/* Zen Header */}
					<div className='relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-4'>
						<div>
							<h2 className='text-base sm:text-lg font-medium text-white'>
								{selectedTechnique.name}
							</h2>
							<p className='text-xs text-white/40 font-mono mt-0.5'>
								Время: <strong className='text-white'>{formatTime(totalElapsedSeconds)}</strong>
								{targetDurationSeconds > 0 && ` / ${formatTime(targetDurationSeconds)}`}
								{' • '}
								Цикл: <strong className='text-white'>{completedCycles + 1}</strong>
							</p>
						</div>

						{/* Quick Zen Actions */}
						<div className='flex items-center gap-2'>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(true)}
								title='Настройки звука и фона природы'
								className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs transition-colors ${
									soundscape !== 'none' || soundEnabled
										? 'bg-violet-500/20 text-violet-300 font-medium'
										: 'bg-white/[0.04] text-white/50 hover:text-white'
								}`}
							>
								<Headphones size={14} />
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
								className={`flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors ${
									vibrationEnabled
										? 'bg-violet-500/20 text-violet-300'
										: 'bg-white/[0.04] text-white/40 hover:text-white'
								}`}
							>
								<Smartphone size={14} />
							</button>

							<button
								type='button'
								onClick={toggleZenMode}
								title='Выйти из дзен-режима (Esc)'
								className='flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 text-xs font-medium text-white transition-colors hover:bg-white/15'
							>
								<Minimize2 size={14} />
								<span className='hidden sm:inline'>Выход (Esc)</span>
							</button>
						</div>
					</div>

					{/* Zen Center: Visualizer Circle */}
					<div className='relative z-10 flex flex-1 items-center justify-center py-6'>
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

					{/* Zen Bottom Controls */}
					<div className='relative z-10 flex flex-col items-center gap-3 border-t border-white/[0.06] pt-5'>
						<div className='flex flex-wrap items-center justify-center gap-3.5'>
							{!isActive ? (
								<button
									type='button'
									onClick={startSession}
									className='flex h-12 items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-10 text-sm font-semibold text-white shadow-xl shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]'
								>
									<Play size={17} fill='currentColor' />
									<span>Начать практику</span>
								</button>
							) : (
								<div className='flex items-center gap-3 rounded-full border border-white/[0.08] bg-[#0c0d11]/80 p-1.5 backdrop-blur-md shadow-2xl'>
									{isPaused ? (
										<button
											type='button'
											onClick={resumeSession}
											className='flex h-11 items-center gap-2 rounded-full bg-violet-600 px-7 text-xs font-semibold text-white transition-all hover:bg-violet-500'
										>
											<Play size={16} fill='currentColor' />
											<span>Продолжить</span>
										</button>
									) : (
										<button
											type='button'
											onClick={pauseSession}
											className='flex h-11 items-center gap-2 rounded-full bg-white/10 px-7 text-xs font-medium text-white transition-colors hover:bg-white/15'
										>
											<Pause size={16} />
											<span>Пауза</span>
										</button>
									)}

									<button
										type='button'
										onClick={finishSession}
										className='flex h-11 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20'
									>
										<Check size={16} />
										<span>Завершить и сохранить</span>
									</button>

									<button
										type='button'
										onClick={resetSession}
										title='Сбросить'
										className='flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white'
									>
										<RotateCcw size={15} />
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
					className='fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md'
					onMouseDown={e => {
						if (e.target === e.currentTarget) setIsAudioSettingsOpen(false)
					}}
				>
					<div className='w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#121317] p-6 sm:p-7 shadow-2xl'>
						{/* Modal Header */}
						<div className='flex items-center justify-between border-b border-white/[0.06] pb-4'>
							<div>
								<h3 className='text-base font-semibold text-white'>
									Звуковое окружение
								</h3>
								<p className='text-xs text-white/50 mt-0.5'>
									Настройте атмосферные фоны природы и медитативные сигналы смены фаз
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

						{/* Section 1: Soundscapes (Фоны природы) */}
						<div className='mt-5'>
							<div className='flex items-center justify-between'>
								<label className='text-xs font-semibold uppercase tracking-wider text-white/60'>
									Фоновые звуки природы
								</label>
								<span className='text-xs text-violet-300 font-medium'>
									{SOUNDSCAPE_OPTIONS.find(s => s.id === soundscape)?.label}
								</span>
							</div>

							{/* Soundscape grid buttons */}
							<div className='mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2'>
								{SOUNDSCAPE_OPTIONS.map(opt => {
									const isSelected = soundscape === opt.id
									const IconComp = getSoundscapeIcon(opt.id)
									return (
										<button
											key={opt.id}
											type='button'
											onClick={() => handleSoundscapeChange(opt.id)}
											className={`flex flex-col items-start gap-1 rounded-2xl p-3 text-left transition-all ${
												isSelected
													? 'bg-violet-600/25 border border-violet-500/40 text-white shadow-sm'
													: 'bg-white/[0.03] border border-transparent text-white/70 hover:bg-white/[0.06] hover:text-white'
											}`}
										>
											<div className='flex items-center gap-1.5'>
												<IconComp
													size={14}
													className={isSelected ? 'text-violet-300' : 'text-white/50'}
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

							{/* Soundscape Volume Slider */}
							{soundscape !== 'none' && (
								<div className='mt-3.5 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-2.5'>
									<Volume2 size={14} className='text-white/50 shrink-0' />
									<span className='text-xs text-white/60 shrink-0'>Громкость фона:</span>
									<input
										type='range'
										min={0}
										max={100}
										value={soundscapeVolume}
										onChange={e => handleSoundscapeVolumeChange(Number(e.target.value))}
										className='h-1.5 flex-1 cursor-pointer appearance-none bg-white/20 accent-violet-500 rounded-full'
									/>
									<span className='w-8 text-right font-mono text-xs text-white/60'>
										{soundscapeVolume}%
									</span>
								</div>
							)}
						</div>

						{/* Section 2: Cue Styles (Сигналы фаз) */}
						<div className='mt-6 border-t border-white/[0.06] pt-5'>
							<div className='flex items-center justify-between'>
								<label className='text-xs font-semibold uppercase tracking-wider text-white/60'>
									Звуковой сигнал смены фазы
								</label>
								<button
									type='button'
									onClick={() => breathingAudio.playTone('inhale')}
									className='flex items-center gap-1 text-[11px] text-violet-400 hover:underline'
								>
									<Play size={11} fill='currentColor' />
									<span>Проверить звук</span>
								</button>
							</div>

							{/* Cue style options */}
							<div className='mt-2.5 grid grid-cols-2 gap-2'>
								{CUE_STYLE_OPTIONS.map(opt => {
									const isSelected = cueStyle === opt.id
									return (
										<button
											key={opt.id}
											type='button'
											onClick={() => handleCueStyleChange(opt.id)}
											className={`flex flex-col items-start gap-0.5 rounded-2xl p-3 text-left transition-all ${
												isSelected
													? 'bg-violet-600/25 border border-violet-500/40 text-white shadow-sm'
													: 'bg-white/[0.03] border border-transparent text-white/70 hover:bg-white/[0.06] hover:text-white'
											}`}
										>
											<div className='flex items-center gap-1.5'>
												{opt.id === 'tibetan' && <Sparkles size={13} className='text-amber-300' />}
												{opt.id === 'bell' && <Bell size={13} className='text-sky-300' />}
												{opt.id === 'soft_sine' && <Activity size={13} className='text-emerald-300' />}
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

							{/* Cue Volume Slider */}
							{cueStyle !== 'none' && (
								<div className='mt-3.5 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-2.5'>
									<Bell size={14} className='text-white/50 shrink-0' />
									<span className='text-xs text-white/60 shrink-0'>Громкость сигнала:</span>
									<input
										type='range'
										min={0}
										max={100}
										value={cueVolume}
										onChange={e => handleCueVolumeChange(Number(e.target.value))}
										className='h-1.5 flex-1 cursor-pointer appearance-none bg-white/20 accent-violet-500 rounded-full'
									/>
									<span className='w-8 text-right font-mono text-xs text-white/60'>
										{cueVolume}%
									</span>
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='mt-6 flex justify-end border-t border-white/[0.06] pt-4'>
							<button
								type='button'
								onClick={() => setIsAudioSettingsOpen(false)}
								className='rounded-full bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 shadow-lg shadow-violet-600/20'
							>
								Применить и закрыть
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
