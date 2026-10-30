import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'Planner',
		short_name: 'Planner',
		description: 'Задачи, тайм-блокинг, мысли и Pomodoro в одном планере.',
		id: '/i',
		start_url: '/i',
		scope: '/',
		display: 'standalone',
		orientation: 'portrait',
		// Тот же цвет, что у фона приложения: строка состояния и панель жестов сливаются с ним
		background_color: '#09090b',
		theme_color: '#09090b',
		icons: [
			{
				src: '/planner-icon-192.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/planner-icon-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/planner-icon-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	}
}
