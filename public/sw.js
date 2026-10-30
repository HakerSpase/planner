/* Service worker Planner: только уведомления (веб-пуш). Страницы и данные не кэширует. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
	let data = {}
	try {
		data = event.data ? event.data.json() : {}
	} catch {
		data = { body: event.data && event.data.text() }
	}
	event.waitUntil(
		self.registration.showNotification(data.title || 'Planner', {
			body: data.body || '',
			icon: '/planner-icon-192.png',
			badge: '/planner-icon-192.png',
			tag: data.tag,
			renotify: Boolean(data.tag),
			requireInteraction: Boolean(data.requireInteraction),
			vibrate: [80, 60, 80],
			data: { url: data.url || '/i' }
		})
	)
})

// Нажали на уведомление — открываем планер (уже открытую вкладку, если есть)
self.addEventListener('notificationclick', event => {
	event.notification.close()
	const url = new URL(event.notification.data?.url || '/i', self.location.origin).href
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
			const existing = clients.find(client => client.url.startsWith(self.location.origin))
			if (existing) {
				existing.navigate(url).catch(() => {})
				return existing.focus()
			}
			return self.clients.openWindow(url)
		})
	)
})
