'use client'

import cn from 'clsx'
import { Music2 } from 'lucide-react'
import { useEffect } from 'react'

import { ambientMusic } from '@/lib/ambient-music'
import { usePreferences } from '@/lib/preferences'

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

/** Кнопка в шапке: включить/выключить музыку одним нажатием */
export function MusicToggle() {
	const [preferences, setPreferences] = usePreferences()
	return (
		<button
			type='button'
			onClick={() => setPreferences({ music: !preferences.music })}
			title={preferences.music ? 'Выключить фоновую музыку' : 'Включить фоновую музыку'}
			aria-label={preferences.music ? 'Выключить фоновую музыку' : 'Включить фоновую музыку'}
			aria-pressed={preferences.music}
			className={cn(
				'grid h-9 w-9 shrink-0 place-items-center transition-colors hover:bg-white/[0.06]',
				preferences.music ? 'text-primary' : 'text-subtle hover:text-fg'
			)}
		>
			<Music2 size={16} />
		</button>
	)
}
