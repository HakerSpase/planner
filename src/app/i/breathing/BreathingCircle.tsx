'use client'

import cn from 'clsx'

import type { IBreathingPhase, IBreathingTechnique } from './breathing.types'

export interface BreathingCircleProps {
	technique: IBreathingTechnique
	currentPhase: IBreathingPhase
	currentPhaseIndex?: number
	phaseRemainingSeconds: number
	phaseProgress: number // 0 to 1
	isActive: boolean
	isPaused: boolean
	cycleCount: number
	isZen?: boolean
}

const VIEW = 400

// Сторона квадрата, по которой идёт маркер: вдох — верх, задержка — право, выдох — низ, пауза — лево
const PHASE_EDGE: Record<IBreathingPhase['type'], number> = {
	inhale: 0,
	holdIn: 1,
	exhale: 2,
	holdOut: 3
}
const MIN_SIDE = 150
const MAX_SIDE = 330

// Плавная S-кривая: вдох и выдох ускоряются в середине и замедляются у краёв
const ease = (t: number) => 0.5 - Math.cos(Math.max(0, Math.min(1, t)) * Math.PI) / 2

function getExpansion(phase: IBreathingPhase, progress: number, isActive: boolean) {
	if (!isActive) return 0.35
	switch (phase.type) {
		case 'inhale':
			return ease(progress)
		case 'holdIn':
			return 1
		case 'exhale':
			return 1 - ease(progress)
		default:
			return 0
	}
}

/**
 * Строгая визуализация: квадрат, который «дышит» между двумя контурами.
 * Точка обходит внешний контур — показывает ход текущей фазы. Без свечений и градиентов.
 */
export function BreathingCircle({
	technique,
	currentPhase,
	phaseRemainingSeconds,
	phaseProgress,
	isActive,
	isPaused,
	cycleCount,
	isZen = false
}: BreathingCircleProps) {
	const expansion = getExpansion(currentPhase, phaseProgress, isActive)
	const side = MIN_SIDE + (MAX_SIDE - MIN_SIDE) * expansion
	const offset = (VIEW - side) / 2

	// Точка-маркер: каждая фаза — своя сторона внешнего квадрата (по часовой, от левого верхнего угла)
	const outer = (VIEW - MAX_SIDE) / 2
	const edge = PHASE_EDGE[currentPhase.type]
	const t = isActive ? Math.max(0, Math.min(1, phaseProgress)) : 0
	const marker = [
		{ x: outer + MAX_SIDE * t, y: outer },
		{ x: outer + MAX_SIDE, y: outer + MAX_SIDE * t },
		{ x: outer + MAX_SIDE * (1 - t), y: outer + MAX_SIDE },
		{ x: outer, y: outer + MAX_SIDE * (1 - t) }
	][edge]

	return (
		<div className='relative flex w-full select-none flex-col items-center justify-center'>
			<div
				className={cn(
					'relative shrink-0',
					isZen
						? 'h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] md:h-[480px] md:w-[480px]'
						: 'h-[260px] w-[260px] sm:h-[300px] sm:w-[300px]'
				)}
			>
				<svg
					viewBox={`0 0 ${VIEW} ${VIEW}`}
					className='absolute inset-0 h-full w-full'
					aria-hidden
				>
					{/* Внешний предел вдоха */}
					<rect
						x={outer}
						y={outer}
						width={MAX_SIDE}
						height={MAX_SIDE}
						fill='none'
						stroke='rgb(255 255 255 / 0.1)'
						strokeWidth={1}
					/>
					{/* Внутренний предел выдоха */}
					<rect
						x={(VIEW - MIN_SIDE) / 2}
						y={(VIEW - MIN_SIDE) / 2}
						width={MIN_SIDE}
						height={MIN_SIDE}
						fill='none'
						stroke='rgb(255 255 255 / 0.08)'
						strokeDasharray='2 6'
						strokeWidth={1}
					/>
					{/* Дышащая форма */}
					<rect
						x={offset}
						y={offset}
						width={side}
						height={side}
						strokeWidth={1.5}
						style={{
							fill: 'rgb(var(--primary) / 0.07)',
							stroke: 'rgb(var(--primary))'
						}}
					/>
					{/* Засечки по углам внешнего квадрата */}
					{[
						[outer, outer],
						[outer + MAX_SIDE, outer],
						[outer + MAX_SIDE, outer + MAX_SIDE],
						[outer, outer + MAX_SIDE]
					].map(([x, y], index) => (
						<rect
							key={index}
							x={x - 3}
							y={y - 3}
							width={6}
							height={6}
							style={{
								fill:
									isActive && index === edge ? 'rgb(var(--fg))' : 'rgb(var(--bg))'
							}}
							stroke='rgb(255 255 255 / 0.3)'
							strokeWidth={1}
						/>
					))}
					{isActive && (
						<rect
							x={marker.x - 4}
							y={marker.y - 4}
							width={8}
							height={8}
							style={{ fill: 'rgb(var(--primary))' }}
						/>
					)}
				</svg>

				<div className='absolute inset-0 flex flex-col items-center justify-center text-center'>
					{isActive ? (
						<>
							<span
								className={cn(
									'font-mono uppercase tracking-[0.25em] text-muted',
									isZen ? 'text-sm' : 'text-xs'
								)}
							>
								{isPaused ? 'Пауза' : currentPhase.name}
							</span>
							<span
								className={cn(
									'mt-1 font-light tabular-nums leading-none tracking-tight text-fg',
									isZen ? 'text-8xl sm:text-9xl' : 'text-6xl'
								)}
							>
								{Math.ceil(phaseRemainingSeconds)}
							</span>
							<span className='mt-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
								Цикл {cycleCount + 1}
							</span>
						</>
					) : (
						<>
							<span className='font-mono text-2xs uppercase tracking-[0.25em] text-subtle'>
								Цикл {technique.totalCycleSeconds} с
							</span>
							<span
								className={cn(
									'mt-2 max-w-[11rem] font-medium leading-tight text-fg',
									isZen ? 'text-xl' : 'text-base'
								)}
							>
								{technique.shortName || technique.name.split('(')[0]}
							</span>
						</>
					)}
				</div>
			</div>
		</div>
	)
}
