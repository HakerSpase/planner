'use client'

import cn from 'clsx'
import {
	CloudRain,
	Disc3,
	Flame,
	Headphones,
	KeyboardMusic,
	type LucideIcon,
	Music2,
	Pause,
	Play,
	SkipBack,
	SkipForward,
	Sparkles,
	Trees,
	Volume2,
	VolumeX,
	Waves
} from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ambientMusic } from '@/lib/ambient-music'
import { type TypeMusicStyle, usePreferences } from '@/lib/preferences'

export const MUSIC_TRACKS: {
	id: TypeMusicStyle
	label: string
	icon: LucideIcon
}[] = [
	{ id: 'lofi', label: 'Лоу-фай', icon: Disc3 },
	{ id: 'jazz', label: 'Ночной джаз', icon: Music2 },
	{ id: 'piano', label: 'Фортепиано', icon: KeyboardMusic },
	{ id: 'ambient', label: 'Эмбиент', icon: Waves },
	{ id: 'rain', label: 'Дождь', icon: CloudRain },
	{ id: 'forest', label: 'Лес', icon: Trees },
	{ id: 'space', label: 'Космос', icon: Sparkles },
	{ id: 'fire', label: 'Камин', icon: Flame }
]

/** Держит фоновую музыку в соответствии с настройками и глушит её на время дыхания */
export function MusicController() {
	const [preferences] = usePreferences()

	useEffect(() => {
		ambientMusic?.configure({
			enabled: preferences.music,
			style: preferences.musicStyle,
			volume: preferences.musicVolume
		})
	}, [preferences.music, preferences.musicStyle, preferences.musicVolume])

	useEffect(() => {
		const onBreathing = (event: Event) =>
			ambientMusic?.setDucked(Boolean((event as CustomEvent).detail?.active))
		window.addEventListener('planner:breathing', onBreathing)
		return () => window.removeEventListener('planner:breathing', onBreathing)
	}, [])

	return null
}

/** Кнопка в шапке: нажатие открывает панель музыки (пауза, трек, громкость), средняя кнопка — сразу пауза */
export function MusicToggle() {
	const [preferences, setPreferences] = usePreferences()
	const [menuOpen, setMenuOpen] = useState(false)
	const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
	const buttonRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)

	const currentIndex = Math.max(
		0,
		MUSIC_TRACKS.findIndex(track => track.id === preferences.musicStyle)
	)
	const currentTrack = MUSIC_TRACKS[currentIndex] || MUSIC_TRACKS[0]

	const openMenu = () => {
		const rect = buttonRef.current?.getBoundingClientRect()
		if (!rect) return
		const width = Math.min(328, window.innerWidth - 16)
		setMenuStyle({
			position: 'fixed',
			top: rect.bottom + 6,
			left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
			width
		})
		setMenuOpen(true)
	}

	useEffect(() => {
		if (!menuOpen) return
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node
			if (
				!buttonRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setMenuOpen(false)
			}
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setMenuOpen(false)
		}
		const onResize = () => setMenuOpen(false)
		document.addEventListener('pointerdown', onPointerDown)
		document.addEventListener('keydown', onKeyDown)
		window.addEventListener('resize', onResize)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			document.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('resize', onResize)
		}
	}, [menuOpen])

	const stepTrack = (delta: -1 | 1) => {
		const nextIndex =
			(currentIndex + delta + MUSIC_TRACKS.length) % MUSIC_TRACKS.length
		setPreferences({
			musicStyle: MUSIC_TRACKS[nextIndex].id,
			music: true
		})
	}

	return (
		<>
			<button
				ref={buttonRef}
				type='button'
				onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
				onAuxClick={event => {
					if (event.button !== 1) return
					event.preventDefault()
					setPreferences({ music: !preferences.music })
				}}
				onContextMenu={event => {
					event.preventDefault()
					if (menuOpen) setMenuOpen(false)
					else openMenu()
				}}
				title={
					preferences.music
						? `Играет: ${currentTrack.label}`
						: 'Фоновая музыка'
				}
				aria-label='Фоновая музыка'
				aria-haspopup='dialog'
				aria-expanded={menuOpen}
				className={cn(
					'grid h-9 w-9 shrink-0 place-items-center transition-colors hover:bg-white/[0.06]',
					menuOpen && 'bg-white/[0.06]',
					preferences.music ? 'text-primary' : 'text-subtle hover:text-fg'
				)}
			>
				{preferences.music ? (
					// Играет — живой эквалайзер; выключено — наушники
					<span
						aria-hidden
						className='flex h-4 items-end gap-[3px]'
					>
						{[0, 1, 2, 3].map(bar => (
							<span
								key={bar}
								className='music-bar w-[3px] bg-current'
								style={{ animationDelay: `${bar * -0.27}s` }}
							/>
						))}
					</span>
				) : (
					<Headphones size={16} />
				)}
			</button>

			{menuOpen &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						ref={menuRef}
						role='dialog'
						aria-label='Управление музыкой'
						style={menuStyle}
						onContextMenu={event => event.preventDefault()}
						className='z-[140] animate-pop-in select-none border border-border bg-elevated shadow-pop'
					>
						{/* Сейчас играет */}
						<div className='flex items-center gap-3 p-3'>
							<button
								type='button'
								onClick={() => setPreferences({ music: !preferences.music })}
								aria-label={preferences.music ? 'Пауза' : 'Включить'}
								className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95'
							>
								{preferences.music ? (
									<Pause
										size={17}
										fill='currentColor'
									/>
								) : (
									<Play
										size={17}
										fill='currentColor'
										className='translate-x-px'
									/>
								)}
							</button>
							<div className='min-w-0 flex-1'>
								<p className='truncate text-sm font-medium text-fg'>
									{currentTrack.label}
								</p>
								<p className='mt-0.5 flex h-4 items-center gap-1.5 text-xs text-subtle'>
									{preferences.music && (
										<span
											aria-hidden
											className='flex h-2.5 items-end gap-[2px] text-primary'
										>
											{[0, 1, 2].map(bar => (
												<span
													key={bar}
													className='music-bar w-[2px] bg-current'
													style={{ animationDelay: `${bar * -0.27}s` }}
												/>
											))}
										</span>
									)}
									{preferences.music ? 'Играет' : 'На паузе'}
								</p>
							</div>
							<div className='flex shrink-0 items-center'>
								<button
									type='button'
									onClick={() => stepTrack(-1)}
									title='Предыдущий трек'
									aria-label='Предыдущий трек'
									className='grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								>
									<SkipBack size={15} />
								</button>
								<button
									type='button'
									onClick={() => stepTrack(1)}
									title='Следующий трек'
									aria-label='Следующий трек'
									className='grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								>
									<SkipForward size={15} />
								</button>
							</div>
						</div>

						{/* Выбор трека */}
						<div className='grid grid-cols-4 gap-px border-y border-border bg-border'>
							{MUSIC_TRACKS.map(track => {
								const active = preferences.musicStyle === track.id
								const Icon = track.icon
								return (
									<button
										key={track.id}
										type='button'
										aria-pressed={active}
										onClick={() =>
											setPreferences({
												musicStyle: track.id,
												music: true
											})
										}
										className={cn(
											'flex h-[4.25rem] min-w-0 flex-col items-center justify-center gap-1.5 px-1 transition-colors',
											active
												? 'bg-[#1d1a2e] text-fg'
												: 'bg-elevated text-muted hover:bg-[#1c1c21] hover:text-fg'
										)}
									>
										<Icon
											size={17}
											className={active ? 'text-primary' : undefined}
										/>
										<span className='w-full truncate text-center text-[11px] leading-tight'>
											{track.label}
										</span>
									</button>
								)
							})}
						</div>

						{/* Громкость */}
						<div className='flex items-center gap-3 px-3 py-3'>
							<button
								type='button'
								onClick={() =>
									setPreferences({
										musicVolume: preferences.musicVolume > 0 ? 0 : 35
									})
								}
								title={
									preferences.musicVolume > 0
										? 'Выключить звук'
										: 'Включить звук'
								}
								className='shrink-0 text-subtle transition-colors hover:text-fg'
							>
								{preferences.musicVolume === 0 ? (
									<VolumeX size={16} />
								) : (
									<Volume2 size={16} />
								)}
							</button>
							<input
								type='range'
								min={0}
								max={100}
								value={preferences.musicVolume}
								onChange={event =>
									setPreferences({
										musicVolume: Number(event.target.value)
									})
								}
								aria-label='Громкость фоновой музыки'
								className='music-volume min-w-0 flex-1'
								style={{ '--value': `${preferences.musicVolume}%` } as CSSProperties}
							/>
							<span className='w-8 shrink-0 text-right font-mono text-2xs tabular-nums text-subtle'>
								{preferences.musicVolume}%
							</span>
						</div>
					</div>,
					document.body
				)}
		</>
	)
}
