'use client'

import {
	Activity,
	Check,
	Clock,
	Flame,
	History,
	Info,
	Moon,
	Pause,
	Play,
	RotateCcw,
	Smartphone,
	Sparkles,
	Square,
	Trash2,
	Volume2,
	VolumeX,
	Wind,
	Zap
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
	BREATHING_TECHNIQUES,
	type IBreathingPhase,
	type IBreathingTechnique
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
		} catch {}

		loadHistory()
	}, [])

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
		if (next) breathingAudio.playTone('inhale')
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
		if (keepScreenOn) breathingAudio.requestWakeLock()
		notifyPhaseChange(firstPhase)
	}

	const pauseSession = () => {
		setIsPaused(true)
		pausedAtRef.current = Date.now()
		accumulatedElapsedRef.current += Math.floor(
			(Date.now() - sessionStartTimeRef.current) / 1000
		)
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
		if (keepScreenOn) breathingAudio.requestWakeLock()
	}

	const finishSession = () => {
		const finalElapsed = totalElapsedSeconds
		const finalCycles = completedCycles
		setIsActive(false)
		setIsPaused(false)
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

	const SelectedIcon = selectedTechnique.icon

	return (
		<div className='w-full pb-16'>
			{/* Page Header */}
			<div className='flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4'>
				<div>
					<div className='flex items-center gap-2.5'>
						<div className='grid h-8 w-8 place-items-center bg-primary/10 text-primary'>
							<Wind size={20} />
						</div>
						<h1 className='text-2xl font-semibold text-white'>
							Дыхательные практики
						</h1>
					</div>
					<p className='mt-1 text-sm text-white/50'>
						Снятие тревоги, глубокое расслабление и фокус на основе доказанных дыхательных циклов.
					</p>
				</div>

				{/* Quick Stats Pill */}
				<div className='flex items-center gap-3 border border-white/10 bg-[#121314] px-3.5 py-2 text-xs'>
					<Sparkles size={14} className='text-primary' />
					<span className='text-white/60'>Сегодня:</span>
					<strong className='font-medium text-white'>
						{todayTotalMinutes} мин ({todaySessions.length} сеанс.)
					</strong>
				</div>
			</div>

			{/* MOBILE-ONLY: Horizontal quick-picker so the visualizer is immediately on-screen */}
			<div className='mt-4 lg:hidden'>
				<label className='text-[11px] font-semibold uppercase tracking-wider text-white/40'>
					Практика:
				</label>
				<div className='mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none'>
					{BREATHING_TECHNIQUES.map(tech => {
						const isSelected = tech.id === selectedTechnique.id
						const TechIcon = tech.icon
						return (
							<button
								key={tech.id}
								type='button'
								onClick={() => selectTechnique(tech)}
								className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-xs font-medium transition-all ${
									isSelected
										? 'border-primary bg-primary/15 text-white shadow-md'
										: 'border-white/10 bg-[#141516] text-white/70 hover:border-white/20'
								}`}
							>
								<TechIcon
									size={14}
									style={{ color: isSelected ? tech.accentColor : 'rgba(255,255,255,0.5)' }}
								/>
								<span>{tech.shortName || tech.name.split('(')[0]}</span>
							</button>
						)
					})}
				</div>
			</div>

			{/* Responsive 2-Column Grid on Desktop */}
			<div className='mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12'>
				{/* MAIN / LEFT COLUMN: Visualizer Stage & Controls (lg:col-span-7 xl:col-span-8) */}
				<div className='flex flex-col gap-6 lg:col-span-7 xl:col-span-8'>
					{/* Interactive Breathing Stage */}
					<div className='relative overflow-hidden border border-white/10 bg-[#121314] p-5 sm:p-8 shadow-2xl'>
						{/* Top bar with timer & toggles */}
						<div className='flex items-center justify-between border-b border-white/[0.07] pb-4'>
							<div className='flex items-center gap-4 text-xs font-mono text-white/70'>
								<span className='flex items-center gap-1.5'>
									<Clock size={13} className='text-white/40' />
									<strong className='text-white'>{formatTime(totalElapsedSeconds)}</strong>
									{targetDurationSeconds > 0 && ` / ${formatTime(targetDurationSeconds)}`}
								</span>
								<span>
									Циклов: <strong className='text-white'>{completedCycles}</strong>
								</span>
							</div>

							{/* Feedback Toggles */}
							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={toggleVibration}
									title={vibrationEnabled ? 'Вибрация включена' : 'Вибрация выключена'}
									className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs transition-colors ${
										vibrationEnabled
											? 'border-primary/50 bg-primary/10 text-primary'
											: 'border-white/10 bg-transparent text-white/40 hover:text-white'
									}`}
								>
									<Smartphone size={13} />
									<span className='hidden sm:inline'>Вибрация</span>
								</button>

								<button
									type='button'
									onClick={toggleSound}
									title={soundEnabled ? 'Звук включен' : 'Звук выключен'}
									className={`flex h-8 items-center gap-1.5 border px-2.5 text-xs transition-colors ${
										soundEnabled
											? 'border-primary/50 bg-primary/10 text-primary'
											: 'border-white/10 bg-transparent text-white/40 hover:text-white'
									}`}
								>
									{soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
									<span className='hidden sm:inline'>Звук</span>
								</button>
							</div>
						</div>

						{/* Visualizer Orb */}
						<BreathingCircle
							technique={selectedTechnique}
							currentPhase={currentPhase}
							phaseRemainingSeconds={phaseRemainingSeconds}
							phaseProgress={phaseProgress}
							isActive={isActive}
							isPaused={isPaused}
							cycleCount={completedCycles}
						/>

						{/* Duration selector when idle */}
						{!isActive && (
							<div className='mt-2 flex flex-wrap items-center justify-center gap-1.5 pt-2'>
								<span className='mr-1.5 text-xs text-white/40'>Время:</span>
								{DURATIONS.map(dur => (
									<button
										key={dur.seconds}
										type='button'
										onClick={() => setTargetDurationSeconds(dur.seconds)}
										className={`border px-2.5 py-1 text-xs transition-colors ${
											targetDurationSeconds === dur.seconds
												? 'border-primary bg-primary/15 font-medium text-white'
												: 'border-white/10 bg-[#151617] text-white/60 hover:border-white/25 hover:text-white'
										}`}
									>
										{dur.label}
									</button>
								))}
							</div>
						)}

						{/* Action Buttons */}
						<div className='mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-white/[0.07] pt-5'>
							{!isActive ? (
								<button
									type='button'
									onClick={startSession}
									className='flex h-11 items-center gap-2.5 border border-primary bg-primary px-8 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95'
								>
									<Play size={16} fill='currentColor' />
									<span>Начать практику</span>
								</button>
							) : (
								<>
									{isPaused ? (
										<button
											type='button'
											onClick={resumeSession}
											className='flex h-11 items-center gap-2 border border-primary bg-primary px-6 text-sm font-semibold text-white transition-all hover:bg-primary/90'
										>
											<Play size={16} fill='currentColor' />
											<span>Продолжить</span>
										</button>
									) : (
										<button
											type='button'
											onClick={pauseSession}
											className='flex h-11 items-center gap-2 border border-white/20 bg-white/10 px-6 text-sm font-medium text-white transition-colors hover:bg-white/15'
										>
											<Pause size={16} />
											<span>Пауза</span>
										</button>
									)}

									<button
										type='button'
										onClick={finishSession}
										className='flex h-11 items-center gap-2 border border-emerald-500/50 bg-emerald-500/10 px-5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20'
									>
										<Check size={16} />
										<span>Завершить и сохранить</span>
									</button>

									<button
										type='button'
										onClick={resetSession}
										title='Сбросить'
										className='flex h-11 w-11 items-center justify-center border border-white/10 bg-transparent text-white/50 transition-colors hover:border-white/20 hover:text-white'
									>
										<RotateCcw size={15} />
									</button>
								</>
							)}
						</div>
					</div>

					{/* Active Technique Information */}
					<div className='border border-white/[0.08] bg-[#141516] p-5'>
						<div className='flex items-center gap-2.5'>
							<SelectedIcon
								size={20}
								style={{ color: selectedTechnique.accentColor }}
							/>
							<h3 className='text-base font-semibold text-white'>
								{selectedTechnique.name}
							</h3>
						</div>
						<p className='mt-2 text-xs leading-relaxed text-white/70'>
							{selectedTechnique.description}
						</p>

						<div className='mt-4 flex flex-wrap gap-2'>
							{selectedTechnique.benefits.map((b, idx) => (
								<span
									key={idx}
									className='inline-flex items-center gap-1.5 border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/80'
								>
									<span
										className='h-1.5 w-1.5 rounded-full'
										style={{ backgroundColor: selectedTechnique.accentColor }}
									/>
									{b}
								</span>
							))}
						</div>
					</div>
				</div>

				{/* SIDEBAR / RIGHT COLUMN: Techniques list & Recorded history (lg:col-span-5 xl:col-span-4) */}
				<div className='flex flex-col gap-6 lg:col-span-5 xl:col-span-4'>
					{/* Technique Selection List (Desktop View) */}
					<div className='border border-white/[0.08] bg-[#141516] p-4 hidden lg:block'>
						<label className='text-xs font-semibold uppercase tracking-wider text-white/40'>
							Техники дыхания
						</label>
						<div className='mt-3 flex flex-col gap-2'>
							{BREATHING_TECHNIQUES.map(tech => {
								const isSelected = tech.id === selectedTechnique.id
								const TechIcon = tech.icon
								return (
									<button
										key={tech.id}
										type='button'
										onClick={() => selectTechnique(tech)}
										className={`flex items-start gap-3 border p-3 text-left transition-all ${
											isSelected
												? 'border-primary/60 bg-[#1a1c1e] shadow-md shadow-black/30'
												: 'border-white/[0.07] bg-[#111213] hover:border-white/20 hover:bg-[#161718]'
										}`}
									>
										<div
											className='mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded border'
											style={{
												borderColor: isSelected ? `${tech.accentColor}60` : 'rgba(255,255,255,0.08)',
												backgroundColor: isSelected ? `${tech.accentColor}18` : 'rgba(255,255,255,0.02)'
											}}
										>
											<TechIcon
												size={15}
												style={{
													color: isSelected ? tech.accentColor : 'rgba(255,255,255,0.6)'
												}}
											/>
										</div>

										<div className='min-w-0 flex-1'>
											<div className='flex items-center justify-between gap-1'>
												<span
													className='text-xs font-semibold truncate'
													style={{
														color: isSelected ? tech.accentColor : '#ffffff'
													}}
												>
													{tech.name}
												</span>
												{isSelected && (
													<span
														className='block h-1.5 w-1.5 shrink-0 rounded-full'
														style={{ backgroundColor: tech.accentColor }}
													/>
												)}
											</div>
											<p className='mt-0.5 line-clamp-1 text-[11px] text-white/50'>
												{tech.tagline}
											</p>
											<span className='mt-1 inline-block text-[10px] text-white/35'>
												Цикл: {tech.totalCycleSeconds} сек
											</span>
										</div>
									</button>
								)
							})}
						</div>
					</div>

					{/* History & Recorded Sessions Card */}
					<div className='border border-white/[0.08] bg-[#141516] p-4 sm:p-5'>
						<div className='flex items-center justify-between border-b border-white/[0.07] pb-3'>
							<div className='flex items-center gap-2'>
								<History size={16} className='text-white/50' />
								<h3 className='text-sm font-semibold text-white'>
									История сеансов
								</h3>
							</div>
							<div className='text-xs text-white/50'>
								Всего: <strong className='text-white'>{sessions.length}</strong>
							</div>
						</div>

						{loadingHistory ? (
							<p className='py-6 text-center text-xs text-white/40'>
								Загружаем историю…
							</p>
						) : sessions.length === 0 ? (
							<p className='py-6 text-center text-xs text-white/40 leading-relaxed'>
								Сеансы автоматически сохраняются после завершения (от 15 секунд или 1 цикла).
							</p>
						) : (
							<div className='mt-2 divide-y divide-white/[0.05] max-h-[380px] overflow-y-auto pr-1'>
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
												className='ml-1 grid h-7 w-7 place-items-center rounded text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-colors'
											>
												<Trash2 size={13} />
											</button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

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
