import { reloadPreferences } from './preferences'
import { createClient } from './supabase/client'

/*
 * Настройки приложения — общие для всех устройств одного аккаунта.
 * Живут в браузере (так они мгновенные и работают без сети), а копия лежит в профиле
 * (user.preferences). Изменили здесь — уходит в профиль; открыли на другом устройстве
 * или вернулись в приложение — подтягиваются новые.
 */

const SYNCED_KEYS = [
	// звук, голос, озвучка, вибрация, музыка, переходы, расшифровка
	'planner-preferences',
	// фон приложения и архива
	'app-background',
	'app-background-library',
	// дыхание: звук, сигналы, вибрация, личный максимум задержки
	'planner_breathing_vibe',
	'planner_breathing_sound',
	'planner_breathing_soundscape',
	'planner_breathing_soundscape_vol',
	'planner_breathing_cue_style',
	'planner_breathing_cue_vol',
	'planner_breathing_max_hold'
]

const META_KEY = 'planner-settings-sync'

const collect = () => {
	const values: Record<string, string> = {}
	for (const key of SYNCED_KEYS) {
		try {
			const value = localStorage.getItem(key)
			if (value !== null) values[key] = value
		} catch {}
	}
	return values
}

const readMeta = () => {
	try {
		return localStorage.getItem(META_KEY) || ''
	} catch {
		return ''
	}
}
const writeMeta = (at: string) => {
	try {
		localStorage.setItem(META_KEY, at)
	} catch {}
}

let applying = false

function apply(values: Record<string, unknown>) {
	applying = true
	for (const key of SYNCED_KEYS) {
		const value = values[key]
		if (typeof value !== 'string') continue
		try {
			localStorage.setItem(key, value)
		} catch {}
	}
	reloadPreferences()
	window.dispatchEvent(new Event('app-background-change'))
	window.dispatchEvent(new Event('planner:settings-synced'))
	applying = false
}

/** Запустить синхронизацию (один раз, в оболочке приложения); вернёт функцию остановки */
export function startSettingsSync() {
	const supabase = createClient()
	let userId: string | null = null
	let last = JSON.stringify(collect())
	let busy = false
	let stopped = false

	const getUser = async () => {
		if (userId) return userId
		const { data } = await supabase.auth.getUser()
		userId = data.user?.id ?? null
		return userId
	}

	const push = async (values: Record<string, string>) => {
		const id = await getUser()
		if (!id) return
		const at = new Date().toISOString()
		const { error } = await supabase
			.from('user')
			.update({ preferences: values, preferences_updated_at: at })
			.eq('id', id)
		if (error) return
		writeMeta(at)
		last = JSON.stringify(values)
	}

	const pull = async () => {
		if (busy || stopped) return
		busy = true
		try {
			const id = await getUser()
			if (!id) return
			const { data } = await supabase
				.from('user')
				.select('preferences, preferences_updated_at')
				.eq('id', id)
				.maybeSingle()
			if (!data) return
			const remote = (data.preferences || {}) as Record<string, unknown>
			const remoteAt: string | null = data.preferences_updated_at
			if (!remoteAt || !Object.keys(remote).length) {
				// В профиле ещё пусто — это устройство первое: отдаём свои настройки
				await push(collect())
				return
			}
			const localAt = readMeta()
			const local = collect()
			// Здесь что-то поменяли, пока не было сети, и это новее профиля — отправляем
			if (JSON.stringify(local) !== last && (!localAt || localAt >= remoteAt)) {
				await push(local)
				return
			}
			if (!localAt || remoteAt > localAt) {
				apply(remote)
				writeMeta(remoteAt)
				last = JSON.stringify(collect())
			}
		} finally {
			busy = false
		}
	}

	let timer: ReturnType<typeof setTimeout> | undefined
	// Ползунок шлёт много изменений подряд — отправляем, когда успокоится
	const soon = () => {
		if (applying) return
		clearTimeout(timer)
		timer = setTimeout(check, 1000)
	}

	const check = () => {
		if (busy || stopped || applying) return
		const values = collect()
		const json = JSON.stringify(values)
		if (json !== last) {
			last = json
			void push(values)
		}
	}

	void pull()
	const interval = setInterval(check, 4000)
	const onVisibility = () => {
		if (document.visibilityState === 'hidden') check()
		else void pull()
	}
	document.addEventListener('visibilitychange', onVisibility)
	window.addEventListener('planner-preferences-change', soon)
	window.addEventListener('app-background-change', soon)

	return () => {
		stopped = true
		clearTimeout(timer)
		clearInterval(interval)
		document.removeEventListener('visibilitychange', onVisibility)
		window.removeEventListener('planner-preferences-change', soon)
		window.removeEventListener('app-background-change', soon)
	}
}
