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
	const strokeWidth = 5
	const radius = (size - strokeWidth * 2) / 2
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, phaseProgress)))

	// Calculate orb scale based on breathing phase
	// Inhale: 1 -> 1.45
	// HoldIn: 1.45
	// Exhale: 1.45 -> 1.0
	// HoldOut: 1.0
	let targetScale = 1
	if (!isActive) {
		targetScale = 1
	} else if (currentPhase.type === 'inhale') {
		targetScale = 1 + phaseProgress * 0.45
	} else if (currentPhase.type === 'holdIn') {
		targetScale = 1.45
	} else if (currentPhase.type === 'exhale') {
		targetScale = 1.45 - phaseProgress * 0.45
	} else if (currentPhase.type === 'holdOut') {
		targetScale = 1.0
	}

	return (
		<div className='relative flex flex-col items-center justify-center py-6'>
			{/* Ambient pulsating background glow */}
			<div
				className='pointer-events-none absolute h-72 w-72 rounded-full transition-all duration-700 blur-3xl'
				style={{
					backgroundColor: technique.accentColor,
					opacity: isActive ? (currentPhase.type === 'inhale' ? 0.35 : 0.2) : 0.12,
					transform: `scale(${targetScale * 1.25})`
				}}
			/>

			{/* Center Visualizer Container */}
			<div className='relative flex h-80 w-80 items-center justify-center'>
				{/* SVG Progress Ring */}
				<svg
					className='absolute inset-0 h-full w-full -rotate-90 transform'
					viewBox={`0 0 ${size} ${size}`}
				>
					{/* Track */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill='none'
						stroke='rgba(255, 255, 255, 0.08)'
						strokeWidth={strokeWidth}
					/>
					{/* Animated Progress */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill='none'
						stroke={currentPhase.color || technique.accentColor}
						strokeWidth={strokeWidth}
						strokeDasharray={circumference}
						strokeDashoffset={strokeDashoffset}
						strokeLinecap='round'
						className='transition-[stroke-dashoffset] duration-100 ease-linear'
					/>
				</svg>

				{/* Outer Atmospheric Aura */}
				<div
					className='absolute rounded-full border transition-all duration-300 ease-out pointer-events-none'
					style={{
						width: '230px',
						height: '230px',
						borderColor: `${technique.accentColor}40`,
						backgroundColor: `${technique.accentColor}08`,
						transform: `scale(${targetScale})`
					}}
				/>

				{/* Core Breathing Orb */}
				<div
					className='relative flex flex-col items-center justify-center rounded-full border border-white/10 bg-[#161719] shadow-2xl transition-all duration-300 ease-out'
					style={{
						width: '200px',
						height: '200px',
						boxShadow: isActive
							? `0 0 50px ${technique.accentColor}30, inset 0 0 30px ${technique.accentColor}15`
							: '0 10px 30px rgba(0,0,0,0.5)',
						transform: `scale(${targetScale})`
					}}
				>
					{isActive ? (
						<div className='flex flex-col items-center text-center px-4'>
							<span
								className='text-xs font-semibold uppercase tracking-widest'
								style={{ color: currentPhase.color || technique.accentColor }}
							>
								{isPaused ? 'Пауза' : currentPhase.name}
							</span>

							<span className='my-1 text-5xl font-light tracking-tight text-white font-mono'>
								{Math.ceil(phaseRemainingSeconds)}
							</span>

							<span className='text-[11px] text-white/50'>
								секунд
							</span>
						</div>
					) : (
						<div className='flex flex-col items-center text-center px-4'>
							<span className='text-xs font-medium uppercase tracking-wider text-white/60'>
								Готовы?
							</span>
							<span className='mt-1 text-sm font-semibold text-white'>
								Нажмите «Старт»
							</span>
							<span className='mt-1 text-[11px] text-white/40'>
								{technique.name.split('(')[0]}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Phase instruction hint below orb */}
			<div className='mt-6 min-h-[50px] max-w-md px-4 text-center'>
				{isActive ? (
					<>
						<p
							className='text-base font-medium text-white transition-opacity duration-300'
						>
							{currentPhase.hint}
						</p>
						<p className='mt-1 text-xs text-white/40'>
							Цикл {cycleCount + 1}
						</p>
					</>
				) : (
					<p className='text-xs text-white/50'>
						Сядьте удобно, выпрямите спину и расслабьте плечи.
					</p>
				)}
			</div>
		</div>
	)
}
