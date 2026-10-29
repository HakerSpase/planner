'use client'

import { Loader, Pause, Play, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

	return (
		<div className='card relative mx-auto w-full max-w-md px-5 py-8 text-center sm:py-10'>
			{isLoading ? (
				<Loader />
			) : sessionsResponse?.data ? (
				<>
					<p className='eyebrow'>
						{timerState.isBreakTime
							? 'Перерыв'
							: timerState.activeRound
								? 'Фокус'
								: 'Сессия завершена'}
					</p>
					<div className='mt-3 font-mono text-6xl font-medium tabular-nums tracking-tight text-fg sm:text-7xl'>
						{formatTime(timerState.secondsLeft)}
					</div>
					<div className='mt-7'>
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
				</>
			) : (
				<Button
					onClick={() => mutate()}
					className='mt-1'
					disabled={isPending}
				>
					{isPending ? 'Создаём…' : 'Создать сессию'}
				</Button>
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
