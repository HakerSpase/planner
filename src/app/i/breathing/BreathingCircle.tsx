'use client'

import React, { useMemo } from 'react'

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
}

// Catmull-Rom spline to smooth Cubic Bézier closed loop
function getCatmullRomBezierPath(points: { x: number; y: number }[]): string {
	const n = points.length
	if (n < 3) return ''

	let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

	for (let i = 0; i < n; i++) {
		const p0 = points[(i - 1 + n) % n]
		const p1 = points[i]
		const p2 = points[(i + 1) % n]
		const p3 = points[(i + 2) % n]

		const cp1x = p1.x + (p2.x - p0.x) / 6
		const cp1y = p1.y + (p2.y - p0.y) / 6

		const cp2x = p2.x - (p3.x - p1.x) / 6
		const cp2y = p2.y - (p3.y - p1.y) / 6

		d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
	}

	return d + ' Z'
}

export function BreathingCircle({
	technique,
	currentPhase,
	currentPhaseIndex = 0,
	phaseRemainingSeconds,
	phaseProgress,
	isActive,
	isPaused,
	cycleCount
}: BreathingCircleProps) {
	// Raw progress in [0, 1]
	let rawExpansion = 0
	if (!isActive) {
		rawExpansion = 0.15
	} else if (currentPhase.type === 'inhale') {
		rawExpansion = Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdIn') {
		rawExpansion = 1.0
	} else if (currentPhase.type === 'exhale') {
		rawExpansion = 1.0 - Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdOut') {
		rawExpansion = 0.0
	}

	// Phase-dependent organic expansion curve
	// Inhale: natural lung filling curve (smooth ease-in-out)
	// Hold in: still fullness with barely perceptible living breath micro-presence
	// Exhale: gentle organic relaxation
	// Hold out (pause): compact serene resting state
	const expansion = useMemo(() => {
		if (!isActive) return 0.15
		if (currentPhase.type === 'holdIn') {
			return 1.0 + Math.sin(phaseProgress * Math.PI) * 0.015
		}
		if (currentPhase.type === 'holdOut') {
			return 0.0
		}
		// Smooth sinusoidal S-curve for natural breath
		return 0.5 - Math.cos(rawExpansion * Math.PI) / 2
	}, [isActive, currentPhase.type, phaseProgress, rawExpansion])

	const accentColor = currentPhase.color || technique.accentColor || '#a78bfa'

	// Generate singular living organic shape path (8 control nodes)
	const { outerPath, auraPath } = useMemo(() => {
		const cx = 200
		const cy = 200
		const N = 8
		const rMin = 94
		const rMax = 152
		const meanR = rMin + (rMax - rMin) * expansion

		const outerPts: { x: number; y: number }[] = []
		const auraPts: { x: number; y: number }[] = []

		for (let i = 0; i < N; i++) {
			const theta = (i * 2 * Math.PI) / N

			// Organic harmonic modulation based on breath phase
			let offset = 0
			if (!isActive) {
				offset = 0.015 * Math.sin(2 * theta)
			} else if (currentPhase.type === 'inhale') {
				// Gentle upward/lateral expansion (chest/diaphragm lifting)
				offset =
					0.045 * expansion * Math.cos(theta - Math.PI / 2) +
					0.025 * expansion * Math.sin(2 * theta)
			} else if (currentPhase.type === 'holdIn') {
				// Expansive stillness
				offset =
					0.04 * Math.cos(theta - Math.PI / 2) +
					0.02 * Math.sin(2 * theta)
			} else if (currentPhase.type === 'exhale') {
				// Soft inward release
				offset =
					(0.015 + 0.025 * expansion) * Math.cos(theta - Math.PI / 2) +
					0.015 * expansion * Math.sin(2 * theta)
			} else {
				// Hold out / pause: quiet compact baseline
				offset = 0.01 * Math.sin(2 * theta)
			}

			const r = meanR * (1 + offset)
			outerPts.push({
				x: cx + r * Math.cos(theta),
				y: cy + r * Math.sin(theta)
			})

			// Aura path is slightly larger for atmospheric soft bleed
			const rAura = r * (1.08 + expansion * 0.08)
			auraPts.push({
				x: cx + rAura * Math.cos(theta),
				y: cy + rAura * Math.sin(theta)
			})
		}

		return {
			outerPath: getCatmullRomBezierPath(outerPts),
			auraPath: getCatmullRomBezierPath(auraPts)
		}
	}, [expansion, isActive, currentPhase.type])

	return (
		<div className='relative flex flex-col items-center justify-center select-none py-3 sm:py-5'>
			{/* Singular Organic Breathing Form (Canvas Scale: 300px mobile, 340px tablet, 370px desktop) */}
			<div className='relative flex h-[290px] w-[290px] sm:h-[340px] sm:w-[340px] items-center justify-center'>
				<svg
					viewBox='0 0 400 400'
					className='absolute inset-0 h-full w-full pointer-events-none'
					style={{ overflow: 'visible' }}
				>
					<defs>
						{/* Soft atmospheric edge glow filter */}
						<filter id='organicAuraGlow' x='-25%' y='-25%' width='150%' height='150%'>
							<feGaussianBlur stdDeviation='24' result='blur' />
						</filter>

						{/* Deep volumetric gradient of the living body */}
						<radialGradient id='organicBodyGrad' cx='50%' cy='42%' r='65%'>
							<stop offset='0%' stopColor='#1c1e28' />
							<stop offset='45%' stopColor='#13141b' />
							<stop offset='82%' stopColor='#0d0e13' />
							<stop offset='100%' stopColor='#08090c' />
						</radialGradient>

						{/* Delicate tonal rim light gradient */}
						<linearGradient id='rimGradient' x1='30%' y1='0%' x2='70%' y2='100%'>
							<stop offset='0%' stopColor={accentColor} stopOpacity={0.7} />
							<stop offset='50%' stopColor={accentColor} stopOpacity={0.2} />
							<stop offset='100%' stopColor={accentColor} stopOpacity={0.5} />
						</linearGradient>

						{/* Subtle luminous core highlight */}
						<radialGradient id='innerCoreLight' cx='50%' cy='35%' r='45%'>
							<stop offset='0%' stopColor={accentColor} stopOpacity={isActive ? 0.22 : 0.08} />
							<stop offset='60%' stopColor={accentColor} stopOpacity={isActive ? 0.06 : 0.02} />
							<stop offset='100%' stopColor='transparent' />
						</radialGradient>
					</defs>

					{/* 1. Atmospheric Soft Aura (Emanating directly from the organic contour) */}
					<path
						d={auraPath}
						fill={accentColor}
						filter='url(#organicAuraGlow)'
						style={{
							opacity: isActive ? 0.25 + expansion * 0.25 : 0.12,
							transition: 'opacity 300ms ease-out'
						}}
					/>

					{/* 2. Primary Singular Organic Form */}
					<path
						d={outerPath}
						fill='url(#organicBodyGrad)'
						stroke='url(#rimGradient)'
						strokeWidth={1.5 + expansion * 1.5}
						style={{
							filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.75))',
							transition: 'stroke-width 200ms ease-out'
						}}
					/>

					{/* 3. Subtle Inner Resonant Light */}
					<path d={outerPath} fill='url(#innerCoreLight)' />
				</svg>

				{/* 4. Integrated Center Typography & Real-time Feedback */}
				<div className='relative z-10 flex flex-col items-center text-center px-4 max-w-[210px] sm:max-w-[240px]'>
					{isActive ? (
						<>
							<span
								className='text-xs font-semibold uppercase tracking-[0.25em] transition-colors duration-300'
								style={{ color: accentColor }}
							>
								{isPaused ? 'Пауза' : currentPhase.name}
							</span>

							<span className='my-1 text-5xl sm:text-6xl font-extralight tracking-tight text-white font-sans tabular-nums'>
								{Math.ceil(phaseRemainingSeconds)}
							</span>

							<span className='text-[10px] text-white/40 uppercase tracking-widest font-mono'>
								секунд
							</span>
						</>
					) : (
						<>
							<span className='text-sm sm:text-base font-medium text-white/95 tracking-wide'>
								{technique.shortName || technique.name.split('(')[0]}
							</span>
							<span
								className='mt-1 text-xs font-mono font-medium'
								style={{ color: technique.accentColor }}
							>
								{technique.totalCycleSeconds} сек / цикл
							</span>
							<span className='mt-2.5 text-[11px] text-white/40 tracking-wider uppercase font-mono'>
								Готовы к практике
							</span>
						</>
					)}
				</div>
			</div>

			{/* Phase instruction hint */}
			<div className='mt-3 min-h-[30px] max-w-md px-4 text-center'>
				<p className='text-sm font-medium text-white/75 transition-opacity duration-300'>
					{isActive ? currentPhase.hint : technique.tagline}
				</p>
			</div>

			{/* Clean Connected Flow Stepper */}
			<div className='mt-3 flex items-center justify-center gap-2 flex-wrap px-2 max-w-lg'>
				{technique.phases.map((phase, idx) => {
					const isCurrent = isActive && currentPhaseIndex === idx
					const isPast = isActive && currentPhaseIndex > idx
					return (
						<div
							key={idx}
							className='flex items-center gap-2'
						>
							<div
								className={`relative overflow-hidden flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all duration-300 ${
									isCurrent
										? 'bg-white/[0.08] text-white'
										: isPast
											? 'text-white/40'
											: 'text-white/50 hover:text-white/70'
								}`}
								style={{
									border: `1px solid ${isCurrent ? `${accentColor}50` : 'rgba(255, 255, 255, 0.05)'}`,
									boxShadow: isCurrent ? `0 0 12px ${accentColor}20` : undefined
								}}
							>
								<span
									className='h-1.5 w-1.5 rounded-full'
									style={{
										backgroundColor: isCurrent ? accentColor : 'rgba(255, 255, 255, 0.2)'
									}}
								/>
								<span
									className='font-medium'
									style={{ color: isCurrent ? accentColor : undefined }}
								>
									{phase.name}
								</span>
								<span className='font-mono text-[10px] opacity-60'>{phase.seconds}с</span>

								{/* Subtle linear progress fill on active step */}
								{isCurrent && (
									<div
										className='absolute bottom-0 left-0 h-[2px] transition-all duration-100 ease-linear'
										style={{
											width: `${Math.min(100, Math.max(0, phaseProgress * 100))}%`,
											backgroundColor: accentColor
										}}
									/>
								)}
							</div>

							{/* Subtle divider arrow between phases */}
							{idx < technique.phases.length - 1 && (
								<span className='text-[10px] text-white/20 select-none'>•</span>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
