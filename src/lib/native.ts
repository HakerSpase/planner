/*
 * Android-приложение (Capacitor) грузит этот же сайт и подкладывает в окно мост
 * window.Capacitor с нативными плагинами. Здесь — безопасный доступ к ним:
 * в обычном браузере всё молча возвращает undefined.
 */

type TypePlugin = Record<string, (...args: any[]) => Promise<any>> & {
	addListener?: (
		event: string,
		callback: (data: any) => void
	) => Promise<{ remove: () => void }>
}

declare global {
	interface Window {
		Capacitor?: {
			isNativePlatform?: () => boolean
			getPlatform?: () => string
			Plugins?: Record<string, TypePlugin | undefined>
		}
	}
}

export const isNativeApp = () =>
	typeof window !== 'undefined' &&
	Boolean(window.Capacitor?.isNativePlatform?.())

/** Нативный плагин по имени: Browser, LocalNotifications, TextToSpeech, KeepAwake… */
export function nativePlugin(name: string): TypePlugin | undefined {
	if (!isNativeApp()) return undefined
	return window.Capacitor?.Plugins?.[name]
}
