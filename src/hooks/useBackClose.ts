import { useEffect, useRef } from 'react'

/**
 * Жест «назад» (и кнопка «назад» в браузере) закрывает открытую панель,
 * а не уводит со страницы. Пока панель открыта, в истории лежит лишняя запись;
 * закрыли панель кнопкой — запись убираем сами.
 *
 * Переход по ссылке из открытой панели (меню на телефоне) делаем заменой этой записи:
 * иначе «назад» для её удаления отменил бы сам переход.
 */
export function useBackClose(open: boolean, onClose: () => void) {
	const closeRef = useRef(onClose)
	closeRef.current = onClose

	useEffect(() => {
		if (!open) return
		const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`
		// Копируем состояние Next.js, чтобы его роутер считал запись своей
		window.history.pushState({ ...window.history.state, __plannerPanel: marker }, '')
		let handled = false

		const onPopState = () => {
			if (window.history.state?.__plannerPanel === marker) return
			handled = true
			closeRef.current()
		}

		const onLinkClick = (event: MouseEvent) => {
			const anchor = (event.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null
			if (
				!anchor ||
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey ||
				anchor.target === '_blank' ||
				anchor.origin !== window.location.origin ||
				window.history.state?.__plannerPanel !== marker
			)
				return
			event.preventDefault()
			event.stopPropagation()
			handled = true
			closeRef.current()
			window.dispatchEvent(
				new CustomEvent('planner:navigate', {
					detail: { href: anchor.pathname + anchor.search + anchor.hash, replace: true }
				})
			)
		}

		window.addEventListener('popstate', onPopState)
		document.addEventListener('click', onLinkClick, true)
		return () => {
			window.removeEventListener('popstate', onPopState)
			document.removeEventListener('click', onLinkClick, true)
			if (!handled && window.history.state?.__plannerPanel === marker) window.history.back()
		}
	}, [open])
}
