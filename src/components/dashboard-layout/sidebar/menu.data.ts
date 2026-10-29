import {
	CalendarRange,
	KanbanSquare,
	LayoutDashboard,
	Library,
	BookOpenText,
	NotebookPen,
	Settings,
	Timer,
	Wind
} from 'lucide-react'

import { DASHBOARD_PAGES } from '@/config/pages-url.config'

import type { IMenuItem } from './menu.interface'

export const MENU: IMenuItem[] = [
	{
		icon: LayoutDashboard,
		link: DASHBOARD_PAGES.HOME,
		name: 'Главная'
	},
	{
		icon: KanbanSquare,
		link: DASHBOARD_PAGES.TASKS,
		name: 'Задачи'
	},
	{
		icon: Timer,
		link: DASHBOARD_PAGES.TIMER,
		name: 'Pomodoro'
	},
	{
		icon: CalendarRange,
		link: DASHBOARD_PAGES.TIME_BLOCKING,
		name: 'Тайм-блокинг'
	},
	{
		icon: NotebookPen,
		link: DASHBOARD_PAGES.THOUGHTS,
		name: 'Мысли'
	},
	{
		icon: Library,
		link: DASHBOARD_PAGES.LIBRARY,
		name: 'Архив'
	},
	{
		icon: Wind,
		link: DASHBOARD_PAGES.BREATHING,
		name: 'Дыхание'
	},
	{
		icon: Settings,
		link: DASHBOARD_PAGES.SETTINGS,
		name: 'Настройки'
	},
	{
		icon: BookOpenText,
		link: DASHBOARD_PAGES.GUIDE,
		name: 'Как пользоваться'
	}
]
