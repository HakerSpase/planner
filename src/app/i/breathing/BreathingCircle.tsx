'use client'

import React from 'react'

import type { IBreathingPhase, IBreathingTechnique } from './breathing.types'

interface BreathingCircleProps {
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
	// Calculate smooth organic expansion for the mindfulness breathing flower
	let expansion = 0
	if (!isActive) {
		expansion = 0.15
	} else if (currentPhase.type === 'inhale') {
		expansion = Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdIn') {
		expansion = 1.0
	} else if (currentPhase.type === 'exhale') {
		expansion = 1.0 - Math.max(0, Math.min(1, phaseProgress))
	} else if (currentPhase.type === 'holdOut') {
		expansion = 0.0
	}

	const accentColor = currentPhase.color || technique.accentColor
	const petalTranslateY = 16 + expansion * 32 // 16px to 48px outward blooming
	const petalScale = 0.95 + expansion * 0.28

	return (
		<div className='relative flex flex-col items-center justify-center py-4 sm:py-6'>
			{/* Soft atmospheric ambient glow */}
			<div
				className='pointer-events-none absolute h-64 w-64 sm:h-80 sm:w-80 rounded-full transition-all duration-700 blur-[85px]'
				style={{
					backgroundColor: accentColor,
					opacity: isActive ? 0.18 + expansion * 0.22 : 0.1,
					transform: `scale(${1 + expansion * 0.3})`
				}}
			/>

			{/* Center Visualizer: Mindful Blooming Lotus */}
			<div className='relative flex h-[260px] w-[260px] sm:h-[300px] sm:w-[300px] items-center justify-center'>
				{/* 6 Soft Overlapping Organic Petals */}
				<div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
					{[0, 60, 120, 180, 240, 300].map((deg, i) => (
						<div
							key={i}
							className='absolute rounded-full transition-all duration-300 ease-out backdrop-blur-sm'
							style={{
								width: '120px',
								height: '120px',
								background: `radial-gradient(circle at 50% 30%, ${accentColor}35 0%, ${accentColor}10 65%, transparent 100%)`,
								border: `1px solid ${accentColor}25`,
								boxShadow: `0 0 20px ${accentColor}15`,
								transform: `rotate(${deg}deg) translateY(-${petalTranslateY}px) scale(${petalScale})`,
								opacity: isActive ? 0.45 + expansion * 0.45 : 0.32
							}}
						/>
					))}
				</div>

				{/* Center Calm Meditation Core */}
				<div
					className='relative z-10 flex flex-col items-center justify-center rounded-full transition-all duration-300 ease-out'
					style={{
						width: '160px',
						height: '160px',
						background: 'radial-gradient(circle at 50% 35%, #1c1d21 0%, #111214 100%)',
						border: `1px solid ${isActive ? `${accentColor}50` : 'rgba(255, 255, 255, 0.1)'}`,
						boxShadow: isActive
							? `0 0 35px ${accentColor}25, 0 16px 40px rgba(0,0,0,0.7)`
							: '0 12px 32px rgba(0,0,0,0.6)',
						transform: `scale(${0.96 + expansion * 0.08})`
					}}
				>
					{isActive ? (
						<div className='flex flex-col items-center text-center px-3'>
							<span
								className='text-xs font-semibold uppercase tracking-widest'
								style={{ color: accentColor }}
							>
								{isPaused ? 'Пауза' : currentPhase.name}
							</span>

							<span className='my-0.5 text-4xl sm:text-5xl font-light tracking-tight text-white font-mono'>
								{Math.ceil(phaseRemainingSeconds)}
							</span>

							<span className='text-[10px] text-white/50 uppercase tracking-wider font-mono'>
								сек
							</span>
						</div>
					) : (
						<div className='flex flex-col items-center text-center px-3'>
							<span className='text-xs sm:text-sm font-medium text-white/90'>
								{technique.shortName || technique.name.split('(')[0]}
							</span>
							<span
								className='mt-1 text-xs font-mono font-medium'
								style={{ color: technique.accentColor }}
							>
								{technique.totalCycleSeconds} сек
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Phase instruction hint */}
			<div className='mt-3 min-h-[36px] max-w-md px-4 text-center'>
				<p className='text-sm sm:text-base font-medium text-white/90 transition-opacity duration-300'>
					{isActive ? currentPhase.hint : technique.tagline}
				</p>
			</div>

			{/* Clean Horizontal Phase Step Tracker */}
			<div className='mt-2.5 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap px-2'>
				{technique.phases.map((phase, idx) => {
					const isCurrent = isActive && currentPhaseIndex === idx
					const isPast = isActive && currentPhaseIndex > idx
					return (
						<div
							key={idx}
							className={`relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 border text-xs transition-all ${
								isCurrent
									? 'border-white/30 bg-white/[0.08] text-white shadow-sm'
									: isPast
										? 'border-white/[0.06] bg-transparent text-white/40'
										: 'border-white/[0.08] bg-white/[0.02] text-white/50'
							}`}
							style={{
								borderColor: isCurrent ? `${accentColor}80` : undefined,
								backgroundColor: isCurrent ? `${accentColor}15` : undefined
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
