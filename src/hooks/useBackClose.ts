import { useEffect, useRef } from 'react'

/**
 * Жест «назад» (и кнопка «назад» в браузере) закрывает открытую панель,
 * а не уводит со страницы. Пока панель открыта, в истории лежит лишняя запись;
 * закрыли панель кнопкой — запись убираем сами.
 */
export function useBackClose(open: boolean, onClose: () => void) {
	const closeRef = useRef(onClose)
	closeRef.current = onClose

	useEffect(() => {
		if (!open) return
		const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`
		// Копируем состояние Next.js, чтобы его роутер считал запись своей
		window.history.pushState({ ...window.history.state, __plannerPanel: marker }, '')
		let closedByBack = false

		const onPopState = () => {
			if (window.history.state?.__plannerPanel === marker) return
			closedByBack = true
			closeRef.current()
		}
		window.addEventListener('popstate', onPopState)
		return () => {
			window.removeEventListener('popstate', onPopState)
			if (!closedByBack && window.history.state?.__plannerPanel === marker)
				window.history.back()
		}
	}, [open])
}
