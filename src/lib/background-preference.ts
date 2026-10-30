import { useSyncExternalStore } from 'react'

export const BACKGROUNDS = [
	{ id: 'stars', label: 'Звёздное небо', description: 'Мерцание, глубина, падающие звёзды' },
	{ id: 'aurora', label: 'Аврора', description: 'Мягкие пятна света' },
	{ id: 'waves', label: 'Волны', description: 'Тонкие линии медленно колышутся' },
	{ id: 'fireflies', label: 'Светлячки', description: 'Тёплые огоньки поднимаются' },
	{ id: 'constellation', label: 'Созвездие', description: 'Точки со связями' },
	{ id: 'grid', label: 'Сетка', description: 'Тонкие линии, плавное смещение' },
	{ id: 'dots', label: 'Точки', description: 'Сетка точек медленно дрейфует' },
	{ id: 'none', label: 'Без фона', description: 'Чистый тёмный фон' }
] as const

export type TypeBackground = (typeof BACKGROUNDS)[number]['id']

// Отдельный фон для архива: по умолчанию тёмный, чтобы читать конспекты без отвлечений
export type TypeBackgroundArea = 'app' | 'library'

const KEYS: Record<TypeBackgroundArea, string> = {
	app: 'app-background',
	library: 'app-background-library'
}
const DEFAULTS: Record<TypeBackgroundArea, TypeBackground> = { app: 'stars', library: 'none' }
const EVENT = 'app-background-change'

const read = (area: TypeBackgroundArea): TypeBackground => {
	try {
		const value = localStorage.getItem(KEYS[area]) as TypeBackground | null
		return BACKGROUNDS.some(item => item.id === value) ? value! : DEFAULTS[area]
	} catch {
		return DEFAULTS[area]
	}
}

const subscribe = (callback: () => void) => {
	window.addEventListener(EVENT, callback)
	window.addEventListener('storage', callback)
	return () => {
		window.removeEventListener(EVENT, callback)
		window.removeEventListener('storage', callback)
	}
}

/** Выбранный фон: в браузере для мгновенной смены, копия — в профиле (settings-sync) */
export function useBackground(
	area: TypeBackgroundArea = 'app'
): [TypeBackground, (value: TypeBackground) => void] {
	const value = useSyncExternalStore(
		subscribe,
		() => read(area),
		() => DEFAULTS[area]
	)
	const setValue = (next: TypeBackground) => {
		try {
			localStorage.setItem(KEYS[area], next)
		} catch {}
		window.dispatchEvent(new Event(EVENT))
	}
	return [value, setValue]
}
