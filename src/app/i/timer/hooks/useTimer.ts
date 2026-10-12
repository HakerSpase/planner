import { useEffect, useState } from 'react'

import type { IPomodoroRoundResponse } from '@/types/pomodoro.types'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'

export function useTimer(): ITimerState {
	const { breakInterval, workInterval } = useLoadSettings()

	const [isRunning, setIsRunning] = useState(false)
	const [isBreakTime, setIsBreakTime] = useState(false)

	const [secondsLeft, setSecondsLeft] = useState(workInterval * 60)
	const [activeRound, setActiveRound] = useState<IPomodoroRoundResponse>()

	useEffect(() => {
		if (!isRunning) return

		const interval = setInterval(() => {
			setSecondsLeft(secondsLeft => Math.max(0, secondsLeft - 1))
		}, 1000)

		return () => clearInterval(interval)
	}, [isRunning])

	useEffect(() => {
		// Ранний выход, если время не истекло
		if (secondsLeft > 0) return

		// Переключение режима и установка нового времени одной операцией
		setIsBreakTime(!isBreakTime)
		setSecondsLeft((isBreakTime ? workInterval : breakInterval) * 60)
	}, [secondsLeft, isBreakTime, workInterval, breakInterval])

	return {
		activeRound,
		secondsLeft,
		setActiveRound,
		setIsRunning,
		setSecondsLeft,
		isRunning
	}
}
