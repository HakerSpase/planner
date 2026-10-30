import { nativePlugin } from './native'

/*
 * Буфер обмена для своих кнопок «Копировать / Вырезать / Вставить».
 * В Android-приложении — системный буфер через плагин (браузерный WebView не даёт
 * читать его), в браузере — Clipboard API.
 */

export async function copyText(text: string) {
	const native = nativePlugin('Clipboard')
	if (native) return native.write({ string: text })
	await navigator.clipboard.writeText(text)
}

export async function readText(): Promise<string> {
	const native = nativePlugin('Clipboard')
	if (native) {
		const { value } = await native.read()
		return typeof value === 'string' ? value : ''
	}
	return navigator.clipboard.readText()
}
