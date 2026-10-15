'use client'

import React from 'react'

import type { IBreathingPhase, IBreathingTechnique } from './breathing.types'

interface BreathingCircleProps {
	technique: IBreathingTechnique
	currentPhase: IBreathingPhase
	phaseRemainingSeconds: number
	phaseProgress: number // 0 to 1
	isActive: boolean
	isPaused: boolean
	cycleCount: number
}

export function BreathingCircle({
	technique,
	currentPhase,
	phaseRemainingSeconds,
	phaseProgress,
	isActive,
	isPaused,
	cycleCount
}: BreathingCircleProps) {
	// Size calculations for SVG ring
	const size = 320
	const strokeWidth = 3
	const radius = (size - strokeWidth * 2) / 2
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, phaseProgress)))

	// Calculate orb scale based on breathing phase
	let targetScale = 1
	if (!isActive) {
		targetScale = 1
	} else if (currentPhase.type === 'inhale') {
		targetScale = 1 + phaseProgress * 0.32
	} else if (currentPhase.type === 'holdIn') {
		targetScale = 1.32
	} else if (currentPhase.type === 'exhale') {
		targetScale = 1.32 - phaseProgress * 0.32
	} else if (currentPhase.type === 'holdOut') {
		targetScale = 1.0
	}

	const accentColor = currentPhase.color || technique.accentColor

	return (
		<div className='relative flex flex-col items-center justify-center py-4 sm:py-7'>
			{/* Soft atmospheric breathing ambient glow (expands and contracts with breath) */}
			<div
				className='pointer-events-none absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full transition-all duration-700 blur-[80px]'
				style={{
					backgroundColor: accentColor,
					opacity: isActive ? (currentPhase.type === 'inhale' ? 0.32 : 0.18) : 0.12,
					transform: `scale(${targetScale * 1.25})`
				}}
			/>

			{/* Center Visualizer Container */}
			<div className='relative flex h-[280px] w-[280px] sm:h-[320px] sm:w-[320px] items-center justify-center'>
				{/* SVG Progress Ring: Clean, elegant, minimal track */}
				<svg
					className='absolute inset-0 h-full w-full -rotate-90 transform'
					viewBox={`0 0 ${size} ${size}`}
				>
					{/* Minimal Track */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill='none'
						stroke='rgba(255, 255, 255, 0.05)'
						strokeWidth={strokeWidth}
					/>
					{/* Animated Smooth Progress Arc */}
					{isActive && (
						<circle
							cx={size / 2}
							cy={size / 2}
							r={radius}
							fill='none'
							stroke={accentColor}
							strokeWidth={strokeWidth}
							strokeDasharray={circumference}
							strokeDashoffset={strokeDashoffset}
							strokeLinecap='round'
							className='transition-[stroke-dashoffset] duration-100 ease-linear'
							style={{
								filter: `drop-shadow(0 0 6px ${accentColor}80)`
							}}
						/>
					)}
				</svg>

				{/* Soft breathing halo behind the core orb */}
				<div
					className='pointer-events-none absolute rounded-full transition-all duration-500 ease-out'
					style={{
						width: '210px',
						height: '210px',
						background: `radial-gradient(circle, ${accentColor}25 0%, ${accentColor}06 60%, transparent 80%)`,
						transform: `scale(${targetScale * 1.15})`
					}}
				/>

				{/* Core Breathing Orb: Smooth, layered, meditative depth */}
				<div
					className='relative flex flex-col items-center justify-center rounded-full transition-all duration-300 ease-out backdrop-blur-md'
					style={{
						width: '180px',
						height: '180px',
						background: isActive
							? `radial-gradient(circle at 50% 35%, #1d1f23 0%, #111214 100%)`
							: `radial-gradient(circle at 50% 35%, #1b1c1f 0%, #101112 100%)`,
						border: `1px solid ${isActive ? `${accentColor}40` : 'rgba(255, 255, 255, 0.08)'}`,
						boxShadow: isActive
							? `0 0 40px ${accentColor}30, 0 16px 48px rgba(0,0,0,0.6), inset 0 0 30px ${accentColor}18`
							: '0 12px 36px rgba(0,0,0,0.5)',
						transform: `scale(${targetScale})`
					}}
				>
					{isActive ? (
						<div className='flex flex-col items-center text-center px-4'>
							<span
								className='text-[11px] sm:text-xs font-semibold uppercase tracking-widest'
								style={{ color: accentColor }}
							>
								{isPaused ? 'Пауза' : currentPhase.name}
							</span>

							<span className='my-0.5 text-4xl sm:text-5xl font-light tracking-tight text-white font-mono'>
								{Math.ceil(phaseRemainingSeconds)}
							</span>

							<span className='text-[10px] text-white/45 uppercase tracking-wider font-mono'>
								сек
							</span>
						</div>
					) : (
						<div className='flex flex-col items-center text-center px-4'>
							<span
								className='text-xs sm:text-sm font-medium tracking-wide text-white/90'
							>
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

			{/* Phase instruction hint below orb */}
			<div className='mt-5 min-h-[46px] max-w-md px-4 text-center'>
				{isActive ? (
					<>
						<p className='text-sm sm:text-base font-medium text-white transition-opacity duration-300'>
							{currentPhase.hint}
						</p>
						<p className='mt-1 text-xs text-white/40 font-mono'>
							Цикл {cycleCount + 1}
						</p>
					</>
				) : (
					<p className='text-xs text-white/45 leading-relaxed'>
						{technique.tagline}
					</p>
				)}
			</div>
		</div>
	)
}
