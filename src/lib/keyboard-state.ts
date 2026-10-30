/**
 * Экранная клавиатура на телефоне. Пока она открыта, на <html> висит data-keyboard="open":
 * по нему прячется нижняя панель навигации, чтобы она не всплывала над клавиатурой.
 */
export function watchKeyboard() {
	const viewport = window.visualViewport
	if (!viewport || !window.matchMedia('(pointer: coarse)').matches) return () => {}

	const root = document.documentElement
	// Полная высота экрана без клавиатуры — отдельно для портрета и альбомной ориентации
	const fullHeight = { portrait: 0, landscape: 0 }

	const isEditable = (element: Element | null) =>
		!!element &&
		(element.matches(
			'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=range]), textarea, select'
		) ||
			(element as HTMLElement).isContentEditable)

	const update = () => {
		const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
		fullHeight[orientation] = Math.max(fullHeight[orientation], viewport.height)
		const open =
			isEditable(document.activeElement) && fullHeight[orientation] - viewport.height > 120
		if (open) root.dataset.keyboard = 'open'
		else delete root.dataset.keyboard
	}

	const onFocusChange = () => requestAnimationFrame(update)

	update()
	viewport.addEventListener('resize', update)
	document.addEventListener('focusin', onFocusChange)
	document.addEventListener('focusout', onFocusChange)
	return () => {
		viewport.removeEventListener('resize', update)
		document.removeEventListener('focusin', onFocusChange)
		document.removeEventListener('focusout', onFocusChange)
		delete root.dataset.keyboard
	}
}
