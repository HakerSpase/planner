import { nativePlugin } from '@/lib/native'
import { createClient } from '@/lib/supabase/client'

/*
 * Веб-пуш: подписка этого браузера на напоминания. Само расписание живёт на сервере
 * (функция send-reminders раз в минуту), поэтому уведомление придёт, даже если
 * планер закрыт — на Windows через Chrome/Edge, на Android через установленный сайт.
 */

// Публичный ключ VAPID — его и должен знать браузер; закрытая половина хранится только на сервере
const VAPID_PUBLIC_KEY =
	'BKBAKa_2bB9f42oI_z0V7lLWTl_DvzOHELw21Y086_IBBPuMbTaYWR1TnWhrWPRgSvyCHkR1c3gvxQCJr52K1bs'

export type TypePushState = 'unsupported' | 'denied' | 'off' | 'on'

export const pushSupported = () =>
	typeof window !== 'undefined' &&
	'serviceWorker' in navigator &&
	'PushManager' in window &&
	'Notification' in window

const toKey = (base64: string) => {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4)
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(raw, char => char.charCodeAt(0))
}

export async function registerServiceWorker() {
	if (!pushSupported()) return null
	return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

/*
 * В настольном приложении (WebView2) веб-пуша нет: уведомления показывает само приложение
 * через Windows, пока оно запущено (в том числе свёрнутым в трей). Разрешение спрашивает
 * окно Windows, а не браузер.
 */
export const desktopBridge = () =>
	typeof window !== 'undefined' ? window.plannerDesktop : undefined

function desktopState(): TypePushState {
	if (typeof Notification === 'undefined') return 'unsupported'
	if (Notification.permission === 'granted') return 'on'
	return Notification.permission === 'denied' ? 'denied' : 'off'
}

/** Включён ли настоящий веб-пуш (его доставит сервер, даже когда планер закрыт) */
export async function hasServerPush() {
	return (
		!desktopBridge() &&
		!nativePlugin('LocalNotifications') &&
		(await getPushState()) === 'on'
	)
}

/*
 * В Android-приложении веб-пуша нет (WebView), зато есть системные уведомления:
 * расписание из задач ставится в Android и сработает, даже когда приложение закрыто.
 */
async function nativeState(): Promise<TypePushState> {
	const { display } =
		await nativePlugin('LocalNotifications')!.checkPermissions()
	return display === 'granted' ? 'on' : display === 'denied' ? 'denied' : 'off'
}

export async function getPushState(): Promise<TypePushState> {
	if (desktopBridge()) return desktopState()
	if (nativePlugin('LocalNotifications')) return nativeState()
	if (!pushSupported()) return 'unsupported'
	if (Notification.permission === 'denied') return 'denied'
	const registration = await navigator.serviceWorker.getRegistration('/')
	const subscription = await registration?.pushManager.getSubscription()
	return subscription && Notification.permission === 'granted' ? 'on' : 'off'
}

const deviceName = () => {
	const agent = navigator.userAgent
	const os = /Android/i.test(agent)
		? 'Android'
		: /iPhone|iPad/i.test(agent)
			? 'iOS'
			: /Windows/i.test(agent)
				? 'Windows'
				: /Mac/i.test(agent)
					? 'macOS'
					: 'Устройство'
	const browser = /Edg\//.test(agent)
		? 'Edge'
		: /Chrome\//.test(agent)
			? 'Chrome'
			: /Firefox\//.test(agent)
				? 'Firefox'
				: /Safari\//.test(agent)
					? 'Safari'
					: 'браузер'
	return `${os} · ${browser}`
}

export async function enablePush() {
	const native = nativePlugin('LocalNotifications')
	if (native) {
		const { display } = await native.requestPermissions()
		if (display !== 'granted') throw new Error('denied')
		return
	}
	const desktop = desktopBridge()
	if (desktop) {
		if (desktop.requestNotifications) {
			const { notifications } = await desktop.requestNotifications()
			if (!notifications) throw new Error('denied')
		}
		// Разрешение уже выдано приложением; если страница ещё не узнала о нём — спросит сама
		if (
			Notification.permission !== 'granted' &&
			(await Notification.requestPermission()) !== 'granted'
		)
			throw new Error('reload')
		return
	}
	if (!pushSupported()) throw new Error('unsupported')
	const permission = await Notification.requestPermission()
	if (permission !== 'granted') throw new Error(permission)
	const registration = (await registerServiceWorker())!
	await navigator.serviceWorker.ready
	const subscription =
		(await registration.pushManager.getSubscription()) ||
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: toKey(VAPID_PUBLIC_KEY)
		}))
	const json = subscription.toJSON()
	const { error } = await createClient().rpc('save_push_subscription', {
		p_endpoint: subscription.endpoint,
		p_p256dh: json.keys?.p256dh,
		p_auth: json.keys?.auth,
		p_device: deviceName()
	})
	if (error) throw error
}

export async function disablePush() {
	if (nativePlugin('LocalNotifications')) return
	const registration = await navigator.serviceWorker.getRegistration('/')
	const subscription = await registration?.pushManager.getSubscription()
	if (!subscription) return
	await createClient()
		.from('push_subscription')
		.delete()
		.eq('endpoint', subscription.endpoint)
	await subscription.unsubscribe()
}

/** Прислать проверочное уведомление на все устройства пользователя */
export async function sendTestPush() {
	const native = nativePlugin('LocalNotifications')
	if (native) {
		await native.schedule({
			notifications: [
				{
					id: 1,
					title: 'Planner',
					body: 'Уведомления работают — так будут приходить напоминания о задачах',
					schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true }
				}
			]
		})
		return 1
	}
	if (desktopBridge()) {
		new Notification('Planner', {
			body: 'Уведомления работают — так будут приходить напоминания о задачах',
			icon: '/planner-icon-192.png'
		})
		return 1
	}
	const { data, error } = await createClient().functions.invoke<{
		delivered: number
	}>('send-reminders', {
		body: { test: true }
	})
	if (error) throw error
	return data?.delivered ?? 0
}
