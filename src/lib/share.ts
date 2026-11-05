import { copyText } from './clipboard'
import { nativePlugin } from './native'

/*
 * Системное меню «Поделиться»: на Android — телефонное (плагин Share), на Windows —
 * окно системы (через настольное приложение или браузер). Если система такого не умеет,
 * ссылка просто копируется.
 */

export async function shareLink({
	title,
	url
}: {
	title: string
	url: string
}): Promise<'shared' | 'copied' | 'cancelled'> {
	const native = nativePlugin('Share')
	const desktop = (window as any).plannerDesktop
	try {
		if (native) {
			await native.share({ title, url, dialogTitle: 'Поделиться листом' })
			return 'shared'
		}
		if (desktop?.share) {
			const result = await desktop.share({ title, url })
			if (result?.shared) return 'shared'
		} else if (navigator.share) {
			await navigator.share({ title, url })
			return 'shared'
		}
	} catch (error) {
		// Закрыли меню, ничего не выбрав, — это не ошибка
		const message = String((error as Error)?.message || error)
		if (
			(error as Error)?.name === 'AbortError' ||
			/cancel|abort/i.test(message)
		)
			return 'cancelled'
	}
	await copyText(url)
	return 'copied'
}
