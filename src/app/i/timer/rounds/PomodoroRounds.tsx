import cn from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { IPomodoroRoundResponse } from '@/types/pomodoro.types'

import styles from './PomodoroRounds.module.scss'

interface IPomodoroRounds {
	rounds: IPomodoroRoundResponse[] | undefined
	nextRoundHandler: () => void
	prevRoundHandler: () => void
	activeRound: IPomodoroRoundResponse | undefined
	disabled?: boolean
	progressPercent?: number
}

export function PomodoroRounds({
	rounds,
	nextRoundHandler,
	prevRoundHandler,
	activeRound,
	disabled = false,
	progressPercent = 0
}: IPomodoroRounds) {
	const isCanPrevRound =
		rounds && rounds.length > 0
			? rounds.some(round => round.isCompleted)
			: false
	const isCanNextRound =
		rounds && rounds.length > 0
			? !rounds[rounds.length - 1]?.isCompleted
			: false

	return (
		<div className={styles.container}>
			<button
				type='button'
				className={styles.button}
				aria-label='Предыдущий раунд'
				title='Предыдущий раунд'
				disabled={!isCanPrevRound || disabled}
				onClick={() => (isCanPrevRound ? prevRoundHandler() : false)}
			>
				<ChevronLeft size={23} />
			</button>
			<div className={styles.roundsContainer}>
				{rounds &&
					rounds.map((round, index) => (
						<div
							key={index}
							aria-label={`Раунд ${index + 1}${round.isCompleted ? ', завершён' : ''}`}
							className={cn(styles.round, {
								[styles.completed]: round.isCompleted
							})}
						>
							<span
								className={styles.fill}
								style={{
									width: `${round.isCompleted ? 100 : round.id === activeRound?.id ? progressPercent : 0}%`
								}}
							/>
						</div>
					))}
			</div>
			<button
				type='button'
				className={styles.button}
				aria-label='Следующий раунд'
				title='Следующий раунд'
				disabled={!isCanNextRound || disabled}
				onClick={() => (isCanNextRound ? nextRoundHandler() : false)}
			>
				<ChevronRight size={23} />
			</button>
		</div>
	)
}
