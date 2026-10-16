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
	isZen?: boolean
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
	cycleCount,
	isZen = false
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

	// Smooth sinusoidal S-curve for organic breath volume
	const expansion = useMemo(() => {
		if (!isActive) return 0.15
		if (currentPhase.type === 'holdIn') {
			// Subtle living presence during breath retention
			return 1.0 + Math.sin(phaseProgress * Math.PI) * 0.012
		}
		if (currentPhase.type === 'holdOut') {
			return 0.0
		}
		return 0.5 - Math.cos(rawExpansion * Math.PI) / 2
	}, [isActive, currentPhase.type, phaseProgress, rawExpansion])

	const accentColor = currentPhase.color || technique.accentColor || '#a78bfa'

	// Sized with a comfortable minimum radius (rMin = 114 -> diameter 228px)
	// so that text is guaranteed to stay comfortably inside
	// even at the most compact exhale/pause phase.
	const { outerPath, auraPath } = useMemo(() => {
		const cx = 200
		const cy = 200
		const N = 8
		const rMin = 114
		const rMax = 160
		const meanR = rMin + (rMax - rMin) * expansion

		const outerPts: { x: number; y: number }[] = []
		const auraPts: { x: number; y: number }[] = []

		for (let i = 0; i < N; i++) {
			const theta = (i * 2 * Math.PI) / N

			// Organic harmonic modulation based on breath phase
			let offset = 0
			if (!isActive) {
				offset = 0.012 * Math.sin(2 * theta)
			} else if (currentPhase.type === 'inhale') {
				// Gentle upward/lateral expansion (chest/diaphragm lifting)
				offset =
					0.04 * expansion * Math.cos(theta - Math.PI / 2) +
					0.02 * expansion * Math.sin(2 * theta)
			} else if (currentPhase.type === 'holdIn') {
				// Expansive stillness
				offset =
					0.038 * Math.cos(theta - Math.PI / 2) +
					0.018 * Math.sin(2 * theta)
			} else if (currentPhase.type === 'exhale') {
				// Soft inward relaxation
				offset =
					(0.012 + 0.025 * expansion) * Math.cos(theta - Math.PI / 2) +
					0.012 * expansion * Math.sin(2 * theta)
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
			const rAura = r * (1.06 + expansion * 0.06)
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

	// Dynamic, calm atmospheric lighting behind the form
	const auraOpacity = useMemo(() => {
		if (!isActive) return isZen ? 0.12 : 0.09
		if (currentPhase.type === 'holdIn') return isZen ? 0.32 : 0.28
		if (currentPhase.type === 'holdOut') return isZen ? 0.12 : 0.1
		return (isZen ? 0.12 : 0.1) + expansion * (isZen ? 0.22 : 0.18)
	}, [isActive, currentPhase.type, expansion, isZen])

	return (
		<div className='relative flex flex-col items-center justify-center select-none py-1 w-full'>
			{/* Multi-layered Volumetric Atmospheric Backlight in Zen Mode */}
			{isZen && (
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
					{/* Layer 1: Expansive Deep Field Bloom (Soft diffuse atmospheric light) */}
					<div
						className='absolute rounded-full blur-[72px] transition-all duration-300 ease-out will-change-transform'
						style={{
							width: '600px',
							height: '600px',
							background: `radial-gradient(circle, ${accentColor} 0%, ${accentColor}18 45%, transparent 70%)`,
							opacity: 0.14 + expansion * 0.22,
							transform: `scale(${0.88 + expansion * 0.24})`
						}}
					/>

					{/* Layer 2: Medium Resonant Core Aura (Volumetric body glow) */}
					<div
						className='absolute rounded-full blur-[42px] transition-all duration-300 ease-out will-change-transform'
						style={{
							width: '420px',
							height: '420px',
							background: `radial-gradient(circle, ${accentColor} 0%, ${accentColor}35 50%, transparent 75%)`,
							opacity: 0.2 + expansion * 0.28,
							transform: `scale(${0.92 + expansion * 0.18})`
						}}
					/>
				</div>
			)}

			{/* Scaled living canvas area */}
			<div
				className={`relative flex items-center justify-center shrink-0 transition-all duration-300 ${
					isZen
						? 'h-[320px] w-[320px] sm:h-[440px] sm:w-[440px] md:h-[500px] md:w-[500px]'
						: 'h-[270px] w-[270px] sm:h-[290px] sm:w-[290px]'
				}`}
			>
				<svg
					viewBox='0 0 400 400'
					className='absolute inset-0 h-full w-full pointer-events-none'
					style={{ overflow: 'visible' }}
				>
					<defs>
						{/* Soft atmospheric edge glow filter */}
						<filter id='organicAuraGlow' x='-25%' y='-25%' width='150%' height='150%'>
							<feGaussianBlur stdDeviation='20' result='blur' />
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
							<stop offset='0%' stopColor={accentColor} stopOpacity={0.65} />
							<stop offset='50%' stopColor={accentColor} stopOpacity={0.2} />
							<stop offset='100%' stopColor={accentColor} stopOpacity={0.45} />
						</linearGradient>

						{/* Subtle luminous core highlight */}
						<radialGradient id='innerCoreLight' cx='50%' cy='35%' r='45%'>
							<stop offset='0%' stopColor={accentColor} stopOpacity={isActive ? 0.2 : 0.07} />
							<stop offset='60%' stopColor={accentColor} stopOpacity={isActive ? 0.05 : 0.02} />
							<stop offset='100%' stopColor='transparent' />
						</radialGradient>
					</defs>

					{/* 1. Atmospheric Soft Aura (Synchronized breathing lighting) */}
					<path
						d={auraPath}
						fill={accentColor}
						filter='url(#organicAuraGlow)'
						style={{
							opacity: auraOpacity,
							transition: 'opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)'
						}}
					/>

					{/* 2. Primary Singular Organic Form */}
					<path
						d={outerPath}
						fill='url(#organicBodyGrad)'
						stroke='url(#rimGradient)'
						strokeWidth={1.5 + expansion * 1.2}
						style={{
							filter: 'drop-shadow(0 18px 36px rgba(0, 0, 0, 0.75))',
							transition: 'stroke-width 200ms ease-out'
						}}
					/>

					{/* 3. Subtle Inner Resonant Light */}
					<path d={outerPath} fill='url(#innerCoreLight)' />
				</svg>

				{/* 4. Independent Stable Text Layer: Centered and bounded */}
				<div className='absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none'>
					<div
						className={`w-full flex flex-col items-center justify-center ${
							isZen ? 'max-w-[240px] sm:max-w-[280px]' : 'max-w-[170px]'
						}`}
					>
						{isActive ? (
							<>
								<span
									className={`font-semibold uppercase tracking-[0.2em] transition-colors duration-300 truncate w-full ${
										isZen ? 'text-xs sm:text-sm' : 'text-xs'
									}`}
									style={{ color: accentColor }}
								>
									{isPaused ? 'Пауза' : currentPhase.name}
								</span>

								<span
									className={`font-extralight tracking-tight text-white font-sans tabular-nums leading-none my-1.5 sm:my-2 ${
										isZen ? 'text-7xl sm:text-8xl md:text-9xl' : 'text-5xl sm:text-6xl'
									}`}
								>
									{Math.ceil(phaseRemainingSeconds)}
								</span>

								{/* Time label omitted in Zen mode to remove visual clutter */}
								{!isZen && (
									<span className='text-[10px] text-white/40 uppercase tracking-widest font-mono'>
										секунд
									</span>
								)}
							</>
						) : (
							<>
								<span
									className={`font-medium text-white/95 tracking-wide truncate w-full ${
										isZen ? 'text-base sm:text-lg' : 'text-sm'
									}`}
								>
									{technique.shortName || technique.name.split('(')[0]}
								</span>
								<span
									className={`font-mono font-medium ${
										isZen ? 'mt-1.5 text-sm' : 'mt-1 text-xs'
									}`}
									style={{ color: technique.accentColor }}
								>
									{technique.totalCycleSeconds}с цикл
								</span>
								<span
									className={`text-white/40 tracking-wider uppercase font-mono ${
										isZen ? 'mt-3 text-xs' : 'mt-2 text-[10px]'
									}`}
								>
									Готовы к практике
								</span>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Phase instruction hint (normal mode only; in Zen mode rendered above the circle) */}
			{!isZen && (
				<div className='min-h-[28px] w-full max-w-sm sm:max-w-md px-3 sm:px-4 text-center flex items-center justify-center mt-1.5 min-w-0'>
					<p className='text-xs sm:text-sm font-medium text-white/70 text-center leading-relaxed break-words line-clamp-2 transition-opacity duration-300'>
						{isActive ? currentPhase.hint : technique.tagline}
					</p>
				</div>
			)}


		</div>
	)
}
