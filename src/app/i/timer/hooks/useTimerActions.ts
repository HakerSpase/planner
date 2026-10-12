import type { IPomodoroRoundResponse } from '@/types/pomodoro.types'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'
import { useUpdateRound } from './useUpdateRound'
import { useUpdateSession } from './useUpdateSession'

type TypeUseTimerActions = ITimerState & {
	rounds: IPomodoroRoundResponse[] | undefined
	sessionId?: string
}

export function useTimerActions({
	activeRound,
	isBreakTime,
	secondsLeft,
	setActiveRound,
	setIsBreakTime,
	setIsRunning,
	setSecondsLeft,
	rounds,
	sessionId
}: TypeUseTimerActions) {
	const { workInterval } = useLoadSettings()
	const { isUpdateRoundPending, updateRound } = useUpdateRound()
	const { updateSession } = useUpdateSession()
	const persistTimerState = (state: {
		activeRoundId?: string | null
		timerIsRunning: boolean
		timerIsBreak: boolean
		timerSecondsRemaining: number
		timerStartedAt: string | null
	}) => {
		if (sessionId) updateSession({ id: sessionId, data: state })
	}

	const pauseHandler = () => {
		setIsRunning(false)
		if (!isBreakTime && activeRound?.id) {
			updateRound({
				id: activeRound.id,
				data: { totalSeconds: secondsLeft, isCompleted: false }
			})
		}
		persistTimerState({
			activeRoundId: activeRound?.id,
			timerIsRunning: false,
			timerIsBreak: isBreakTime,
			timerSecondsRemaining: secondsLeft,
			timerStartedAt: null
		})
	}

	const playHandler = () => {
		if (secondsLeft > 0) {
			setIsRunning(true)
			persistTimerState({
				activeRoundId: activeRound?.id,
				timerIsRunning: true,
				timerIsBreak: isBreakTime,
				timerSecondsRemaining: secondsLeft,
				timerStartedAt: new Date().toISOString()
			})
		}
	}

	const nextRoundHandler = () => {
		if (isBreakTime || !activeRound?.id || !rounds?.length) return

		const activeIndex = rounds.findIndex(round => round.id === activeRound.id)
		if (activeIndex < 0) return
		const nextRound = rounds
			.slice(activeIndex + 1)
			.find(round => !round.isCompleted)

		updateRound({
			id: activeRound.id,
			data: { isCompleted: true, totalSeconds: 0 }
		})
		setIsRunning(false)
		setActiveRound(nextRound)
		setSecondsLeft(nextRound ? nextRound.totalSeconds || workInterval * 60 : 0)
		setIsBreakTime(false)
		persistTimerState({
			activeRoundId: nextRound?.id || null,
			timerIsRunning: false,
			timerIsBreak: false,
			timerSecondsRemaining: nextRound
				? nextRound.totalSeconds || workInterval * 60
				: 0,
			timerStartedAt: null
		})
	}

	const prevRoundHandler = () => {
		if (!rounds?.length) return
		const activeIndex = activeRound
			? rounds.findIndex(round => round.id === activeRound.id)
			: rounds.length
		const previousRound = rounds
			.slice(0, activeIndex)
			.reverse()
			.find(round => round.isCompleted)

		const targetRound =
			previousRound || activeRound || rounds.find(round => round.isCompleted)
		if (!targetRound?.id) return
		updateRound({
			id: targetRound.id,
			data: { isCompleted: false, totalSeconds: workInterval * 60 }
		})
		setIsRunning(false)
		setIsBreakTime(false)
		setActiveRound(targetRound)
		setSecondsLeft(workInterval * 60)
		persistTimerState({
			activeRoundId: targetRound.id,
			timerIsRunning: false,
			timerIsBreak: false,
			timerSecondsRemaining: workInterval * 60,
			timerStartedAt: null
		})
	}

	return {
		isUpdateRoundPending,
		pauseHandler,
		playHandler,
		nextRoundHandler,
		prevRoundHandler,
		persistTimerState
	}
}
