'use client'

import React from 'react'

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
	// Smooth organic easing for expansion
	let rawExpansion = 0
	if (!isActive) {
		rawExpansion = 0.18
	} else if (currentPhase.type === 'inhale') {
		rawExpansion = Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdIn') {
		rawExpansion = 1.0
	} else if (currentPhase.type === 'exhale') {
		rawExpansion = 1.0 - Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdOut') {
		rawExpansion = 0.0
	}

	// Smooth sinusoidal breathing curve for natural lung sensation
	const expansion =
		!isActive
			? 0.18
			: currentPhase.type === 'holdIn'
				? 1.0 + Math.sin(phaseProgress * Math.PI * 2) * 0.025
				: currentPhase.type === 'holdOut'
					? 0.0
					: 0.5 - Math.cos(rawExpansion * Math.PI) / 2

	const accentColor = currentPhase.color || technique.accentColor || '#a78bfa'

	// Dimensional calculations for the expanded size (380-420px container)
	const petalTranslateY = 28 + expansion * 48 // 28px -> 76px outward bloom
	const petalScale = 0.92 + expansion * 0.34
	const rippleScale = 0.88 + expansion * 0.38

	return (
		<div className='relative flex flex-col items-center justify-center py-6 sm:py-8 select-none'>
			{/* Multi-layered soft ambient breathing glow */}
			<div
				className='pointer-events-none absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full transition-all duration-700 ease-out blur-[110px]'
				style={{
					backgroundColor: accentColor,
					opacity: isActive ? 0.22 + expansion * 0.28 : 0.12,
					transform: `scale(${1 + expansion * 0.35})`
				}}
			/>
			<div
				className='pointer-events-none absolute h-48 w-48 sm:h-64 sm:w-64 rounded-full transition-all duration-500 ease-out blur-[70px]'
				style={{
					backgroundColor: '#a78bfa',
					opacity: isActive ? 0.15 + expansion * 0.2 : 0.08,
					transform: `scale(${0.9 + expansion * 0.25})`
				}}
			/>

			{/* Hero Visualizer Stage (Grand scale: 320px on mobile, 400px on tablet, 430px on desktop) */}
			<div className='relative flex h-[310px] w-[310px] sm:h-[380px] sm:w-[380px] md:h-[420px] md:w-[420px] items-center justify-center'>
				{/* Whisper-thin outer guide ripple rings */}
				<div
					className='pointer-events-none absolute inset-0 rounded-full border border-white/[0.05] transition-transform duration-700 ease-out'
					style={{
						transform: `scale(${rippleScale})`,
						borderColor: isActive ? `${accentColor}30` : 'rgba(255, 255, 255, 0.05)',
						opacity: isActive ? 0.4 + expansion * 0.5 : 0.25
					}}
				/>
				<div
					className='pointer-events-none absolute inset-4 sm:inset-6 rounded-full border border-white/[0.03] transition-transform duration-700 ease-out'
					style={{
						transform: `scale(${0.92 + expansion * 0.28})`,
						borderColor: isActive ? `${accentColor}20` : 'rgba(255, 255, 255, 0.03)',
						opacity: isActive ? 0.35 + expansion * 0.45 : 0.2
					}}
				/>

				{/* 6 Organic Mindful Petals (Lotus bloom) */}
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
					{[0, 60, 120, 180, 240, 300].map((deg, i) => (
						<div
							key={i}
							className='absolute rounded-full transition-all duration-300 ease-out backdrop-blur-[2px]'
							style={{
								width: '160px',
								height: '160px',
								background: `radial-gradient(circle at 50% 30%, ${accentColor}40 0%, ${accentColor}12 55%, transparent 85%)`,
								border: `1px solid ${accentColor}25`,
								boxShadow: `0 0 25px ${accentColor}15`,
								transform: `rotate(${deg}deg) translateY(-${petalTranslateY}px) scale(${petalScale})`,
								opacity: isActive ? 0.45 + expansion * 0.45 : 0.3
							}}
						/>
					))}
				</div>

				{/* Center Sanctuary Core (Smooth graphite tactile orb) */}
				<div
					className='relative z-10 flex flex-col items-center justify-center rounded-full transition-all duration-300 ease-out'
					style={{
						width: '200px',
						height: '200px',
						background: 'radial-gradient(circle at 50% 30%, #1a1c24 0%, #101115 75%, #0b0c0e 100%)',
						border: `1px solid ${isActive ? `${accentColor}55` : 'rgba(255, 255, 255, 0.08)'}`,
						boxShadow: isActive
							? `0 0 45px ${accentColor}30, inset 0 1px 2px rgba(255,255,255,0.2), 0 24px 50px rgba(0,0,0,0.8)`
							: '0 16px 40px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
						transform: `scale(${0.96 + expansion * 0.1})`
					}}
				>
					{isActive ? (
						<div className='flex flex-col items-center text-center px-4'>
							<span
								className='text-xs sm:text-sm font-semibold uppercase tracking-[0.22em] transition-colors duration-300'
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
						</div>
					) : (
						<div className='flex flex-col items-center text-center px-4'>
							<span className='text-sm sm:text-base font-semibold text-white/90'>
								{technique.shortName || technique.name.split('(')[0]}
							</span>
							<span
								className='mt-1 text-xs font-mono font-medium'
								style={{ color: technique.accentColor }}
							>
								{technique.totalCycleSeconds} сек / цикл
							</span>
							<span className='mt-2.5 text-[11px] text-white/40 tracking-wide'>
								Нажмите «Начать»
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Phase instruction hint */}
			<div className='mt-5 min-h-[38px] max-w-md px-4 text-center'>
				<p className='text-sm sm:text-base font-medium text-white/80 transition-opacity duration-300'>
					{isActive ? currentPhase.hint : technique.tagline}
				</p>
			</div>

			{/* Clean Minimal Horizontal Flow Stepper */}
			<div className='mt-4 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap px-2 max-w-xl'>
				{technique.phases.map((phase, idx) => {
					const isCurrent = isActive && currentPhaseIndex === idx
					const isPast = isActive && currentPhaseIndex > idx
					return (
						<div
							key={idx}
							className={`relative overflow-hidden flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs transition-all duration-300 ${
								isCurrent
									? 'bg-white/[0.08] text-white shadow-lg'
									: isPast
										? 'bg-white/[0.02] text-white/40'
										: 'bg-white/[0.03] text-white/60'
							}`}
							style={{
								boxShadow: isCurrent ? `0 0 16px ${accentColor}25` : undefined,
								border: `1px solid ${isCurrent ? `${accentColor}70` : 'rgba(255,255,255,0.06)'}`
							}}
						>
							<span
								className='font-medium'
								style={{ color: isCurrent ? accentColor : undefined }}
							>
								{phase.name}
							</span>
							<span className='font-mono text-[11px] opacity-60'>{phase.seconds}с</span>

							{/* Progress bar inside active phase pill */}
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
					)
				})}
			</div>
		</div>
	)
}
