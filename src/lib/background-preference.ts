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

const KEY = 'app-background'
const EVENT = 'app-background-change'
const DEFAULT: TypeBackground = 'stars'

const read = (): TypeBackground => {
	try {
		const value = localStorage.getItem(KEY) as TypeBackground | null
		return BACKGROUNDS.some(item => item.id === value) ? value! : DEFAULT
	} catch {
		return DEFAULT
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

/** Выбранный фон хранится в браузере (на каждом устройстве свой) */
export function useBackground(): [TypeBackground, (value: TypeBackground) => void] {
	const value = useSyncExternalStore(subscribe, read, () => DEFAULT)
	const setValue = (next: TypeBackground) => {
		try {
			localStorage.setItem(KEY, next)
		} catch {}
		window.dispatchEvent(new Event(EVENT))
	}
	return [value, setValue]
}
