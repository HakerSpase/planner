import { useSyncExternalStore } from 'react'

/*
 * Настройки «ощущений» (переходы, вибрация, музыка) — хранятся в браузере,
 * на каждом устройстве свои. Меняются мгновенно во всех открытых местах.
 */

export type TypeTransition = 'off' | 'soft' | 'smooth'
export type TypeHapticLevel = 'off' | 'light' | 'strong'
export type TypeMusicStyle =
	| 'lofi'
	| 'jazz'
	| 'piano'
	| 'ambient'
	| 'rain'
	| 'forest'
	| 'space'
	| 'fire'

export interface IPreferences {
	transition: TypeTransition
	haptics: TypeHapticLevel
	hapticNav: boolean
	hapticButtons: boolean
	hapticChecks: boolean
	music: boolean
	musicStyle: TypeMusicStyle
	musicVolume: number
}

const DEFAULTS: IPreferences = {
	transition: 'smooth',
	haptics: 'light',
	hapticNav: true,
	hapticButtons: false,
	hapticChecks: true,
	music: false,
	musicStyle: 'lofi',
	musicVolume: 35
}

const KEY = 'planner-preferences'
const EVENT = 'planner-preferences-change'

let cache: IPreferences | null = null

function read(): IPreferences {
	if (cache) return cache
	try {
		cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
	} catch {
		cache = DEFAULTS
	}
	return cache!
}

export function getPreferences() {
	return typeof window === 'undefined' ? DEFAULTS : read()
}

export function setPreferences(patch: Partial<IPreferences>) {
	cache = { ...read(), ...patch }
	try {
		localStorage.setItem(KEY, JSON.stringify(cache))
	} catch {}
	window.dispatchEvent(new Event(EVENT))
}

const subscribe = (callback: () => void) => {
	const onStorage = (event: StorageEvent) => {
		if (event.key !== KEY) return
		cache = null
		callback()
	}
	window.addEventListener(EVENT, callback)
	window.addEventListener('storage', onStorage)
	return () => {
		window.removeEventListener(EVENT, callback)
		window.removeEventListener('storage', onStorage)
	}
}

export function usePreferences(): [IPreferences, typeof setPreferences] {
	const value = useSyncExternalStore(subscribe, read, () => DEFAULTS)
	return [value, setPreferences]
}

/* ---------- Вибрация (Android; iPhone из браузера вибрировать не умеет) ---------- */

export function haptic(kind: 'nav' | 'button' | 'check') {
	if (typeof navigator === 'undefined' || !navigator.vibrate) return
	const prefs = read()
	if (prefs.haptics === 'off') return
	if (kind === 'nav' && !prefs.hapticNav) return
	if (kind === 'button' && !prefs.hapticButtons) return
	if (kind === 'check' && !prefs.hapticChecks) return
	navigator.vibrate(prefs.haptics === 'strong' ? 22 : 9)
}
