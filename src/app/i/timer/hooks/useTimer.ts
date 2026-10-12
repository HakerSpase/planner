import { useEffect, useRef, useState } from 'react'

import type { IPomodoroRoundResponse } from '@/types/pomodoro.types'

import type { ITimerState } from '../timer.types'

import { useLoadSettings } from './useLoadSettings'

export function useTimer(): ITimerState {
	const { workInterval } = useLoadSettings()
	const [isRunning, setIsRunning] = useState(false)
	const [isBreakTime, setIsBreakTime] = useState(false)
	const [secondsLeft, setSecondsLeft] = useState(workInterval * 60)
	const secondsLeftRef = useRef(secondsLeft)
	const [activeRound, setActiveRound] = useState<IPomodoroRoundResponse>()

	useEffect(() => {
		secondsLeftRef.current = secondsLeft
	}, [secondsLeft])

	useEffect(() => {
		if (!isRunning || secondsLeftRef.current <= 0) return
		const deadline = Date.now() + secondsLeftRef.current * 1000

		const interval = window.setInterval(() => {
			setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
		}, 250)

		return () => window.clearInterval(interval)
	}, [isRunning])

	useEffect(() => {
		if (secondsLeft === 0 && isRunning) setIsRunning(false)
	}, [isRunning, secondsLeft])

	return {
		activeRound,
		isBreakTime,
		secondsLeft,
		setActiveRound,
		setIsBreakTime,
		setIsRunning,
		setSecondsLeft,
		isRunning
	}
}
