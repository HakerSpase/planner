'use client'

import cn from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

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
const CENTER = VIEW / 2
const R_MIN = 112
const R_MAX = 158
const POINTS = 14

// Плавная S-кривая: вдох и выдох ускоряются в середине и замедляются у краёв
const ease = (t: number) => 0.5 - Math.cos(Math.max(0, Math.min(1, t)) * Math.PI) / 2

function targetExpansion(phase: IBreathingPhase, progress: number, isActive: boolean) {
	if (!isActive) return 0.3
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

// Замкнутая кривая Catmull-Rom через точки — мягкий органический контур
function smoothPath(points: { x: number; y: number }[]) {
	const n = points.length
	let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
	for (let i = 0; i < n; i++) {
		const p0 = points[(i - 1 + n) % n]
		const p1 = points[i]
		const p2 = points[(i + 1) % n]
		const p3 = points[(i + 2) % n]
		d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)}, ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
	}
	return `${d} Z`
}

// Каждая точка контура колышется своей суммой синусоид — форма «живёт», но не дёргается
function blobPath(radius: number, time: number, amplitude: number, scale = 1) {
	const points = Array.from({ length: POINTS }, (_, i) => {
		const theta = (i / POINTS) * Math.PI * 2
		const wobble =
			Math.sin(time * 0.9 + i * 1.7) * 0.55 +
			Math.sin(time * 0.53 + i * 2.9 + 1.3) * 0.3 +
			Math.sin(time * 1.37 + i * 0.6 + 2.1) * 0.15
		const r = radius * scale * (1 + amplitude * wobble)
		return { x: CENTER + r * Math.cos(theta), y: CENTER + r * Math.sin(theta) }
	})
	return smoothPath(points)
}

/**
 * Живая «дышащая» форма: растёт на вдохе, замирает на задержке, сжимается на выдохе.
 * Плавность — через requestAnimationFrame: значение из таймера (раз в 60 мс)
 * догоняется по кадрам, а контур слегка колышется даже в покое.
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
	const id = useId().replace(/:/g, '')
	const accent = currentPhase.color || technique.accentColor || '#7c5cff'
	const target = targetExpansion(currentPhase, phaseProgress, isActive)

	const targetRef = useRef(target)
	targetRef.current = target
	const pausedRef = useRef(isPaused)
	pausedRef.current = isPaused

	const [frame, setFrame] = useState({ expansion: target, time: 0 })

	useEffect(() => {
		let raf = 0
		let last = performance.now()
		let expansion = targetRef.current
		let time = 0
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

		const tick = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000)
			last = now
			// экспоненциальное сглаживание к целевому значению
			expansion += (targetRef.current - expansion) * (1 - Math.exp(-dt * 9))
			if (!reduceMotion && !pausedRef.current) time += dt
			setFrame({ expansion, time })
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [])

	const { expansion, time } = frame
	const radius = R_MIN + (R_MAX - R_MIN) * expansion
	// На задержке колыхание чуть заметнее — форма «держит» воздух
	const amplitude = currentPhase.type === 'holdIn' && isActive ? 0.03 : 0.018
	const body = blobPath(radius, time, amplitude)
	const aura = blobPath(radius, time * 0.8 + 2, amplitude * 1.6, 1.08 + expansion * 0.05)

	return (
		<div className='relative flex w-full select-none flex-col items-center justify-center'>
			{/* Динамический свет: мягкое свечение от формы расходится по всей сцене и дышит вместе с ней */}
			<div
				aria-hidden
				className='pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[1100px] w-[1100px] rounded-full'
				style={{
					background: `radial-gradient(circle, ${accent}55 0%, ${accent}22 22%, ${accent}0a 42%, transparent 62%)`,
					opacity: 0.35 + expansion * 0.65,
					transform: `translate(-50%, -50%) scale(${0.62 + expansion * 0.38})`
				}}
			/>
			<div
				className={cn(
					'relative shrink-0',
					isZen
						? 'h-[320px] w-[320px] sm:h-[440px] sm:w-[440px] md:h-[500px] md:w-[500px]'
						: 'h-[270px] w-[270px] sm:h-[310px] sm:w-[310px]'
				)}
			>
				<svg
					viewBox={`0 0 ${VIEW} ${VIEW}`}
					className='absolute inset-0 h-full w-full overflow-visible'
					aria-hidden
				>
					<defs>
						<filter
							id={`${id}-blur`}
							x='-30%'
							y='-30%'
							width='160%'
							height='160%'
						>
							<feGaussianBlur stdDeviation='18' />
						</filter>
						<radialGradient
							id={`${id}-body`}
							cx='42%'
							cy='36%'
							r='75%'
						>
							<stop
								offset='0%'
								stopColor={accent}
								stopOpacity={0.32 + expansion * 0.18}
							/>
							<stop
								offset='55%'
								stopColor={accent}
								stopOpacity={0.12 + expansion * 0.08}
							/>
							<stop
								offset='100%'
								stopColor={accent}
								stopOpacity={0.04}
							/>
						</radialGradient>
						<linearGradient
							id={`${id}-rim`}
							x1='20%'
							y1='0%'
							x2='80%'
							y2='100%'
						>
							<stop
								offset='0%'
								stopColor={accent}
								stopOpacity={0.9}
							/>
							<stop
								offset='55%'
								stopColor={accent}
								stopOpacity={0.25}
							/>
							<stop
								offset='100%'
								stopColor={accent}
								stopOpacity={0.6}
							/>
						</linearGradient>
					</defs>

					{/* Мягкое свечение вокруг формы */}
					<path
						d={aura}
						fill={accent}
						opacity={0.1 + expansion * 0.14}
						filter={`url(#${id}-blur)`}
					/>
					{/* Тело формы */}
					<path
						d={body}
						fill={`url(#${id}-body)`}
						stroke={`url(#${id}-rim)`}
						strokeWidth={1.4 + expansion * 0.8}
					/>
				</svg>

				<div className='absolute inset-0 flex flex-col items-center justify-center text-center'>
					{isActive ? (
						<>
							<span
								className={cn(
									'font-mono uppercase tracking-[0.25em] text-fg/80',
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
