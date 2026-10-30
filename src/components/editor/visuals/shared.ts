import { useEffect, useRef, useState } from 'react'

// Цвета линий и столбцов: различимы на тёмном фоне и между собой
export const VISUAL_COLORS = ['#8b7bff', '#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#fb7185', '#2dd4bf']

/** Ширина элемента — графики перестраиваются под экран и поворот телефона */
export function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null)
	const [width, setWidth] = useState(0)
	useEffect(() => {
		const element = ref.current
		if (!element) return
		const update = () => setWidth(Math.round(element.getBoundingClientRect().width))
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	return [ref, width] as const
}
