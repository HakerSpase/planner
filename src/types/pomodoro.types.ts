import type { IBase } from './root.types'

export interface IPomodoroRoundResponse extends IBase {
	isCompleted?: boolean
	totalSeconds: number
}

export interface IPomodoroSessionResponse extends IBase {
	isCompleted?: boolean
	rounds?: IPomodoroRoundResponse[]
	activeRoundId?: string | null
	timerIsRunning?: boolean
	timerIsBreak?: boolean
	timerSecondsRemaining?: number
	timerStartedAt?: string | null
}

export type TypePomodoroSessionState = Partial<
	Omit<IPomodoroSessionResponse, 'id' | 'createdAt' | 'updatedAt'>
>

export type TypePomodoroRoundState = Partial<
	Omit<IPomodoroRoundResponse, 'id' | 'createdAt' | 'updatedAt'>
>

export type TypePomodoroSessionFormState = TypePomodoroSessionState
export type TypePomodoroRoundFormState = TypePomodoroRoundState
