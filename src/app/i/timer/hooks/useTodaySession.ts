import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'
import { pomodoroService } from '@/services/pomodoro.service'

export function useTodaySession({
	setActiveRound,
	setSecondsLeft,
	isBreakTime
}: ITimerState) {
	const { breakInterval, workInterval } = useLoadSettings()

	const {
		data: sessionsResponse,
		isLoading,
		refetch,
		isSuccess
	} = useQuery({
		queryKey: ['get today session'],
		queryFn: () => pomodoroService.getTodaySession()
	})

	const rounds = sessionsResponse?.data?.rounds

	useEffect(() => {
		if (!isSuccess) return
		const activeRound = rounds?.find(round => !round.isCompleted)
		setActiveRound(activeRound)

		if (activeRound && !isBreakTime) {
			setSecondsLeft(
				activeRound.totalSeconds > 0
					? activeRound.totalSeconds
					: workInterval * 60
			)
		}
	}, [
		isSuccess,
		rounds,
		isBreakTime,
		setActiveRound,
		setSecondsLeft,
		workInterval
	])

	return { sessionsResponse, isLoading, workInterval, breakInterval }
}
