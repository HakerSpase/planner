'use client'

import cn from 'clsx'
import {
	ChevronLeft,
	ChevronRight,
	Headphones,
	Pause,
	Play,
	Volume2,
	VolumeX
} from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ambientMusic } from '@/lib/ambient-music'
import { type TypeMusicStyle, usePreferences } from '@/lib/preferences'

export const MUSIC_TRACKS: { id: TypeMusicStyle; label: string }[] = [
	{ id: 'lofi', label: 'Лоу-фай' },
	{ id: 'jazz', label: 'Ночной джаз' },
	{ id: 'piano', label: 'Фортепиано' },
	{ id: 'ambient', label: 'Эмбиент' },
	{ id: 'rain', label: 'Дождь' },
	{ id: 'forest', label: 'Лес' },
	{ id: 'space', label: 'Космос' },
	{ id: 'fire', label: 'Камин' }
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

/** Кнопка в шапке: ЛКМ — включить/выключить, ПКМ — минималистичное меню (пауза, трек, громкость) */
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
		const width = 224
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
				onClick={() => setPreferences({ music: !preferences.music })}
				onContextMenu={event => {
					event.preventDefault()
					if (menuOpen) setMenuOpen(false)
					else openMenu()
				}}
				title={
					preferences.music
						? `${currentTrack.label} · ЛКМ — пауза, ПКМ — управление`
						: 'Включить фоновую музыку (ПКМ — настройки)'
				}
				aria-label={
					preferences.music
						? 'Выключить фоновую музыку'
						: 'Включить фоновую музыку'
				}
				aria-pressed={preferences.music}
				aria-expanded={menuOpen}
				className={cn(
					'grid h-9 w-9 shrink-0 place-items-center transition-colors hover:bg-white/[0.06]',
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
						className='z-[140] animate-pop-in select-none border border-border bg-elevated p-3 shadow-pop'
					>
						{/* Пауза / пуск и переключение трека */}
						<div className='flex items-center justify-between gap-1'>
							<button
								type='button'
								onClick={() => setPreferences({ music: !preferences.music })}
								className='flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs font-medium text-fg transition-colors hover:text-primary'
							>
								<span className='grid h-6 w-6 shrink-0 place-items-center border border-border bg-surface text-fg'>
									{preferences.music ? (
										<Pause
											size={11}
											fill='currentColor'
										/>
									) : (
										<Play
											size={11}
											fill='currentColor'
											className='translate-x-px'
										/>
									)}
								</span>
								<span className='truncate'>{currentTrack.label}</span>
							</button>
							<div className='flex shrink-0 items-center'>
								<button
									type='button'
									onClick={() => stepTrack(-1)}
									title='Предыдущий трек'
									aria-label='Предыдущий трек'
									className='grid h-6 w-6 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
								>
									<ChevronLeft size={14} />
								</button>
								<button
									type='button'
									onClick={() => stepTrack(1)}
									title='Следующий трек'
									aria-label='Следующий трек'
									className='grid h-6 w-6 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
								>
									<ChevronRight size={14} />
								</button>
							</div>
						</div>

						{/* Быстрый выбор трека */}
						<div className='mt-2.5 grid grid-cols-2 gap-1 border-t border-border pt-2.5'>
							{MUSIC_TRACKS.map(track => {
								const active = preferences.musicStyle === track.id
								return (
									<button
										key={track.id}
										type='button'
										onClick={() =>
											setPreferences({
												musicStyle: track.id,
												music: true
											})
										}
										className={cn(
											'truncate px-2 py-1 text-left text-xs transition-colors',
											active
												? 'bg-primary/15 font-medium text-fg'
												: 'text-muted hover:bg-white/[0.04] hover:text-fg'
										)}
									>
										{track.label}
									</button>
								)
							})}
						</div>

						{/* Громкость */}
						<div className='mt-2.5 flex items-center gap-2 border-t border-border pt-2.5'>
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
								className='text-subtle transition-colors hover:text-fg'
							>
								{preferences.musicVolume === 0 ? (
									<VolumeX size={14} />
								) : (
									<Volume2 size={14} />
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
								className='h-1 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
							/>
							<span className='w-8 text-right font-mono text-2xs tabular-nums text-subtle'>
								{preferences.musicVolume}%
							</span>
						</div>
					</div>,
					document.body
				)}
		</>
	)
}
