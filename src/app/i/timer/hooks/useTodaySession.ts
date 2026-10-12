import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'
import { pomodoroService } from '@/services/pomodoro.service'

export function useTodaySession({
	setActiveRound,
	setSecondsLeft,
	setIsRunning,
	setIsBreakTime
}: ITimerState) {
	const { breakInterval, workInterval, timeZone } = useLoadSettings()

	const {
		data: sessionsResponse,
		isLoading,
		isSuccess
	} = useQuery({
		queryKey: ['get today session', timeZone],
		queryFn: () => pomodoroService.getTodaySession(timeZone),
		refetchInterval: 3000,
		refetchIntervalInBackground: true,
		enabled: Boolean(timeZone)
	})

	const rounds = sessionsResponse?.data?.rounds

	useEffect(() => {
		if (!isSuccess) return
		const activeRound =
			rounds?.find(
				round => round.id === sessionsResponse?.data?.activeRoundId
			) || rounds?.find(round => !round.isCompleted)
		setActiveRound(activeRound)
		const session = sessionsResponse?.data
		const isBreak = session?.timerIsBreak ?? false
		setIsBreakTime(isBreak)
		const savedSeconds = session?.timerIsRunning
			? (session.timerSecondsRemaining ?? workInterval * 60)
			: session?.timerSecondsRemaining || activeRound?.totalSeconds
				? session?.timerSecondsRemaining || activeRound?.totalSeconds || 0
				: activeRound
					? workInterval * 60
					: 0
		const elapsed =
			session?.timerIsRunning && session.timerStartedAt
				? Math.max(
						0,
						Math.ceil(
							(Date.now() - new Date(session.timerStartedAt).getTime()) / 1000
						)
					)
				: 0
		setSecondsLeft(Math.max(0, savedSeconds - elapsed))
		setIsRunning(Boolean(session?.timerIsRunning && savedSeconds > elapsed))
	}, [
		isSuccess,
		rounds,
		sessionsResponse?.data,
		setActiveRound,
		setIsBreakTime,
		setIsRunning,
		setSecondsLeft,
		workInterval
	])

	return { sessionsResponse, isLoading, workInterval, breakInterval }
}
