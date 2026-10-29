'use client'

import { Loader, Pause, Play, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useLocalStorage } from '@/hooks/useLocalStorage'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/buttons/Button'

import { formatTime } from './format-time'
import { useCreateSession } from './hooks/useCreateSession'
import { useDeleteSession } from './hooks/useDeleteSession'
import { useLoadSettings } from './hooks/useLoadSettings'
import { useTimer } from './hooks/useTimer'
import { useTimerActions } from './hooks/useTimerActions'
import { useTodaySession } from './hooks/useTodaySession'
import { PomodoroRounds } from './rounds/PomodoroRounds'
import { FocusTaskPicker } from './FocusTaskPicker'

const formatMinutes = (minutes: number) => {
	const h = Math.floor(minutes / 60)
	const m = Math.round(minutes % 60)
	return h ? `${h} ч${m ? ` ${m} мин` : ''}` : `${m} мин`
}

const isTypingTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))

export function Pomodoro() {
	const timerState = useTimer()
	const { timeZone } = useLoadSettings()
	const { isLoading, sessionsResponse, workInterval, breakInterval } =
		useTodaySession(timerState)
	const rounds = sessionsResponse?.data?.rounds
	const actions = useTimerActions({
		...timerState,
		rounds,
		sessionId: sessionsResponse?.data?.id
	})
	const progressPercent = Math.max(
		0,
		Math.min(
			100,
			((workInterval * 60 - timerState.secondsLeft) / (workInterval * 60)) * 100
		)
	)
	const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
	const [focusTaskId, setFocusTaskId] = useLocalStorage<string>({
		key: 'pomodoro-focus-task',
		defaultValue: ''
	})
	const autoCompletedRoundId = useRef<string>()
	const { isPending, mutate } = useCreateSession(timeZone)
	const { deleteSession, isDeletePending } = useDeleteSession(() => {
		setIsResetConfirmOpen(false)
		timerState.setIsRunning(false)
		timerState.setIsBreakTime(false)
		timerState.setActiveRound(undefined)
		timerState.setSecondsLeft(workInterval * 60)
	})

	useEffect(() => {
		if (timerState.secondsLeft !== 0) {
			autoCompletedRoundId.current = undefined
			return
		}
		if (!timerState.activeRound?.id) return
		const phaseKey = `${timerState.activeRound.id}:${timerState.isBreakTime ? 'break' : 'work'}`
		if (autoCompletedRoundId.current === phaseKey) return
		autoCompletedRoundId.current = phaseKey

		if (timerState.isBreakTime) {
			timerState.setIsBreakTime(false)
			timerState.setSecondsLeft(workInterval * 60)
			timerState.setIsRunning(true)
			actions.persistTimerState({
				activeRoundId: timerState.activeRound.id,
				timerIsRunning: true,
				timerIsBreak: false,
				timerSecondsRemaining: workInterval * 60,
				timerStartedAt: new Date().toISOString()
			})
			return
		}

		const activeIndex =
			rounds?.findIndex(round => round.id === timerState.activeRound?.id) ?? -1
		const nextRound =
			activeIndex >= 0
				? rounds?.slice(activeIndex + 1).find(round => !round.isCompleted)
				: undefined
		actions.nextRoundHandler()

		if (nextRound) {
			timerState.setIsBreakTime(true)
			timerState.setSecondsLeft(breakInterval * 60)
			timerState.setIsRunning(true)
			actions.persistTimerState({
				activeRoundId: nextRound.id,
				timerIsRunning: true,
				timerIsBreak: true,
				timerSecondsRemaining: breakInterval * 60,
				timerStartedAt: new Date().toISOString()
			})
		}
	}, [
		actions,
		breakInterval,
		rounds,
		timerState.activeRound,
		timerState.isBreakTime,
		timerState.secondsLeft,
		timerState.setIsBreakTime,
		timerState.setIsRunning,
		timerState.setSecondsLeft,
		workInterval
	])

	const canToggle =
		!actions.isUpdateRoundPending &&
		(Boolean(timerState.activeRound) || timerState.isBreakTime)
	const toggleTimer = timerState.isRunning
		? actions.pauseHandler
		: actions.playHandler

	// Пробел — старт/пауза, если фокус не в поле ввода
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return
			if (!canToggle || !sessionsResponse?.data) return
			event.preventDefault()
			toggleTimer()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [canToggle, sessionsResponse?.data, toggleTimer])

	// Обратный отсчёт во вкладке браузера, пока таймер идёт
	useEffect(() => {
		if (!timerState.isRunning) return
		const previousTitle = document.title
		document.title = `${formatTime(timerState.secondsLeft)} · ${timerState.isBreakTime ? 'Перерыв' : 'Фокус'}`
		return () => {
			document.title = previousTitle
		}
	}, [timerState.isRunning, timerState.isBreakTime, timerState.secondsLeft])

	const roundsDone = rounds?.filter(round => round.isCompleted).length || 0
	const roundsLeft = (rounds?.length || 0) - roundsDone
	const focusStats = [
		{ label: 'Фокус сегодня', value: formatMinutes(roundsDone * workInterval) },
		{ label: 'Раунды', value: `${roundsDone} / ${rounds?.length || 0}` },
		{
			label: 'До конца',
			value: roundsLeft
				? `≈ ${formatMinutes(roundsLeft * workInterval + Math.max(0, roundsLeft - 1) * breakInterval)}`
				: 'готово'
		}
	]

	return (
		<div className='relative w-full border border-border bg-surface text-center lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]'>
			{isLoading ? (
				<div className='flex justify-center py-16 lg:col-span-2 lg:row-span-2'>
					<Loader />
				</div>
			) : sessionsResponse?.data ? (
				<>
					<FocusTaskPicker
						value={focusTaskId}
						onChange={setFocusTaskId}
					/>
					<div className='flex flex-col items-center justify-center px-5 pb-8 pt-8 sm:pt-10 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-[30rem] lg:border-r lg:border-border lg:py-16'>
					<p className='eyebrow'>
						{timerState.isBreakTime
							? 'Перерыв'
							: timerState.activeRound
								? 'Фокус'
								: 'Сессия завершена'}
					</p>
					<div className='mt-3 font-mono text-6xl font-medium tabular-nums tracking-tight text-fg sm:text-7xl lg:text-8xl'>
						{formatTime(timerState.secondsLeft)}
					</div>
					<div className='mt-7 w-full max-w-md'>
						<PomodoroRounds
							rounds={rounds}
							nextRoundHandler={actions.nextRoundHandler}
							prevRoundHandler={actions.prevRoundHandler}
							activeRound={timerState.activeRound}
							disabled={actions.isUpdateRoundPending || timerState.isBreakTime}
							progressPercent={timerState.isBreakTime ? 0 : progressPercent}
						/>
					</div>
					<p className='mt-3 text-xs text-subtle'>
						{timerState.isBreakTime
							? `Отдыхайте ${breakInterval} мин. Следующий раунд начнётся автоматически.`
							: timerState.activeRound
								? `Раунд ${Math.max(1, (rounds?.findIndex(round => round.id === timerState.activeRound?.id) ?? 0) + 1)} из ${rounds?.length || 0}`
								: 'Все раунды завершены'}
					</p>
					<div className='mt-7 flex items-center justify-center gap-3'>
						<button
							type='button'
							aria-label={timerState.isRunning ? 'Пауза' : 'Начать таймер'}
							title={timerState.isRunning ? 'Пауза' : 'Начать таймер'}
							className='grid h-12 w-12 place-items-center bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40'
							onClick={
								timerState.isRunning
									? actions.pauseHandler
									: actions.playHandler
							}
							disabled={
								actions.isUpdateRoundPending ||
								(!timerState.activeRound && !timerState.isBreakTime)
							}
						>
							{timerState.isRunning ? <Pause size={21} /> : <Play size={21} />}
						</button>
						<button
							type='button'
							aria-label='Начать сессию заново'
							title='Начать сессию заново'
							className='grid h-12 w-12 place-items-center border border-border text-subtle transition-colors hover:bg-white/[0.05] hover:text-fg disabled:opacity-40'
							onClick={() => setIsResetConfirmOpen(true)}
							disabled={isDeletePending}
						>
							<RefreshCcw size={16} />
						</button>
					</div>
					<p className='mt-4 hidden font-mono text-2xs uppercase tracking-wider text-subtle sm:block'>
						Пробел — старт / пауза
					</p>
					</div>
					<dl className='grid grid-cols-3 divide-x divide-border border-t border-border lg:col-start-2 lg:row-start-2 lg:grid-cols-1 lg:content-start lg:divide-x-0 lg:divide-y lg:border-t-0 lg:text-left'>
						{focusStats.map(stat => (
							<div
								key={stat.label}
								className='px-3 py-4 lg:px-5 lg:py-5'
							>
								<dt className='eyebrow'>{stat.label}</dt>
								<dd className='mt-1.5 text-sm tabular-nums text-fg'>{stat.value}</dd>
							</div>
						))}
					</dl>
				</>
			) : (
				<div className='flex flex-col items-center px-5 py-14 lg:col-span-2 lg:row-span-2 lg:py-24'>
					<p className='text-sm text-muted'>Сегодня сессия ещё не начата</p>
					<Button
						onClick={() => mutate()}
						className='mt-4'
						disabled={isPending}
					>
						{isPending ? 'Создаём…' : 'Создать сессию'}
					</Button>
				</div>
			)}
			<ConfirmDialog
				open={isResetConfirmOpen}
				title='Начать заново?'
				description='Текущая сессия и отметки раундов будут удалены.'
				confirmLabel='Начать заново'
				isPending={isDeletePending}
				onConfirm={() =>
					sessionsResponse?.data?.id && deleteSession(sessionsResponse.data.id)
				}
				onClose={() => setIsResetConfirmOpen(false)}
			/>
		</div>
	)
}
