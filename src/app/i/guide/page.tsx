import {
	CalendarClock,
	CheckSquare2,
	Coffee,
	Lightbulb,
	Timer
} from 'lucide-react'
import type { Metadata } from 'next'

import { Heading } from '@/components/ui/Heading'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

export const metadata: Metadata = {
	title: 'Как пользоваться',
	...NO_INDEX_PAGE
}

const guideSections = [
	{
		icon: CheckSquare2,
		title: 'Задачи',
		intro: 'Соберите список дел и выберите удобный способ просмотра.',
		steps: [
			'Добавляйте задачу в нужный день и задавайте приоритет.',
			'Переключайтесь между списком и доской. Перетаскивайте карточки между колонками, чтобы изменить дату.',
			'Нажмите на строку заметки на карточке, чтобы открыть компактный редактор с подробностями, ссылками и чек-листом.'
		]
	},
	{
		icon: CalendarClock,
		title: 'Тайм-блокинг',
		intro:
			'Разложите день по временным блокам: например, работа, дорога, обед и отдых.',
		steps: [
			'Для каждого блока укажите название и длительность в минутах. Например, 45 минут — это 45, а не 0 часов.',
			'Перетаскивайте блоки, чтобы менять их порядок. Цвет помогает быстро различать занятия.',
			'Внизу отображается точная сумма запланированного времени и остаток суток с учётом минут. Если план больше 24 часов, появится предупреждение.'
		]
	},
	{
		icon: Timer,
		title: 'Pomodoro',
		intro:
			'Работайте короткими сфокусированными отрезками и делайте регулярные перерывы.',
		steps: [
			'В настройках задайте длительность работы, отдыха и число раундов.',
			'Создайте сессию на сегодня и нажмите ▶, когда начинаете работу. Пауза сохраняет прогресс.',
			'После отрезка переключитесь на следующий раунд и отдохните. Стрелки позволяют исправить выбор раунда, круговая стрелка начинает сессию заново.'
		]
	},
	{
		icon: Coffee,
		title: 'Статистика и привычный ритм',
		intro: 'Главная страница показывает общий прогресс по задачам.',
		steps: [
			'Начните с небольшого списка на сегодня и оцените его длительность в тайм-блокинге.',
			'Если времени не хватает, перенесите часть задач или уменьшите объём дня.',
			'Отмечайте выполненное и используйте заметки, чтобы следующий шаг всегда был под рукой.'
		]
	}
]

export default function GuidePage() {
	return (
		<div className='max-w-5xl'>
			<Heading title='Как пользоваться Planner' />
			<p className='mt-4 max-w-3xl text-sm leading-6 text-white/55'>
				Короткая подсказка по основным инструментам. Начните с задач,
				распределите их по времени и используйте Pomodoro, чтобы удерживать
				фокус.
			</p>
			<div className='mt-6 grid gap-4 md:grid-cols-2'>
				{guideSections.map(section => {
					const Icon = section.icon
					return (
						<section
							key={section.title}
							className='border border-white/[0.08] bg-[#151617] p-4 sm:p-6'
						>
							<div className='flex items-center gap-3'>
								<span className='border-l-2 border-primary pl-2.5 text-primary'>
									<Icon size={19} />
								</span>
								<h2 className='text-base font-semibold text-white/90'>
									{section.title}
								</h2>
							</div>
							<p className='mt-4 text-sm leading-6 text-white/60'>
								{section.intro}
							</p>
							<ol className='mt-4 space-y-3'>
								{section.steps.map((step, index) => (
									<li
										key={step}
										className='flex gap-3 text-sm leading-6 text-white/70'
									>
										<span className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-white/10 text-[11px] text-white/50'>
											{index + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
						</section>
					)
				})}
			</div>
			<div className='mt-5 flex gap-3 border-l-2 border-primary/50 bg-white/[0.02] p-4 text-sm leading-6 text-white/65'>
				<Lightbulb
					size={18}
					className='mt-0.5 shrink-0 text-primary'
				/>
				<p>
					Не обязательно расписывать день по минутам. Оставляйте между блоками
					запас — так план остаётся выполнимым, даже если дела займут чуть
					больше времени.
				</p>
			</div>
		</div>
	)
}
