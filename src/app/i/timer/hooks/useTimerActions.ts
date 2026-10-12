import type { IPomodoroRoundResponse } from '@/types/pomodoro.types'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'
import { useUpdateRound } from './useUpdateRound'

type TypeUseTimerActions = ITimerState & {
	rounds: IPomodoroRoundResponse[] | undefined
}

export function useTimerActions({
	activeRound,
	isBreakTime,
	secondsLeft,
	setActiveRound,
	setIsBreakTime,
	setIsRunning,
	setSecondsLeft,
	rounds
}: TypeUseTimerActions) {
	const { workInterval } = useLoadSettings()
	const { isUpdateRoundPending, updateRound } = useUpdateRound()

	const pauseHandler = () => {
		setIsRunning(false)
		if (isBreakTime || !activeRound?.id) return

		updateRound({
			id: activeRound.id,
			data: { totalSeconds: secondsLeft, isCompleted: false }
		})
	}

	const playHandler = () => {
		if (secondsLeft > 0) setIsRunning(true)
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
	}

	return {
		isUpdateRoundPending,
		pauseHandler,
		playHandler,
		nextRoundHandler,
		prevRoundHandler
	}
}
