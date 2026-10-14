export type BreathingPhaseType = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export interface IBreathingPhase {
	type: BreathingPhaseType
	name: string
	hint: string
	seconds: number
	color: string
}

export interface IBreathingTechnique {
	id: string
	name: string
	tagline: string
	description: string
	benefits: string[]
	accentColor: string
	bgGlow: string
	phases: IBreathingPhase[]
	totalCycleSeconds: number
}

export const BREATHING_TECHNIQUES: IBreathingTechnique[] = [
	{
		id: 'box',
		name: 'Квадратное дыхание (4-4-4-4)',
		tagline: 'Фокус, самообладание и ясность',
		description:
			'Техника спецназа Navy SEALs для мгновенного снижения уровня кортизола и возврата полного контроля в стрессовых ситуациях.',
		benefits: ['Снижает тревожность', 'Улучшает концентрацию', 'Стабилизирует пульс'],
		accentColor: '#10b981',
		bgGlow: 'rgba(16, 185, 129, 0.25)',
		totalCycleSeconds: 16,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Глубокий вдох через нос, наполняя живот и грудь',
				seconds: 4,
				color: '#10b981'
			},
			{
				type: 'holdIn',
				name: 'Задержка',
				hint: 'Удерживайте воздух, плечи и лицо расслаблены',
				seconds: 4,
				color: '#34d399'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Плавный и ровный выдох через рот',
				seconds: 4,
				color: '#059669'
			},
			{
				type: 'holdOut',
				name: 'Задержка',
				hint: 'Пауза на выдохе без напряжения в легких',
				seconds: 4,
				color: '#047857'
			}
		]
	},
	{
		id: '4-7-8',
		name: 'Техника 4-7-8',
		tagline: 'Глубокое расслабление и крепкий сон',
		description:
			'Всемирно известный метод д-ра Эндрю Вейла. Действует как естественный природный транквилизатор для нервной системы.',
		benefits: ['Помогает быстро уснуть', 'Снимает панику', 'Активирует парасимпатику'],
		accentColor: '#818cf8',
		bgGlow: 'rgba(129, 140, 248, 0.25)',
		totalCycleSeconds: 19,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Бесшумный спокойный вдох через нос',
				seconds: 4,
				color: '#818cf8'
			},
			{
				type: 'holdIn',
				name: 'Задержка',
				hint: 'Удерживайте дыхание, наблюдайте за покоем',
				seconds: 7,
				color: '#a5b4fc'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Медленный выдох через рот со звуком «с-с-ш-ш»',
				seconds: 8,
				color: '#6366f1'
			}
		]
	},
	{
		id: 'coherence',
		name: 'Когерентное дыхание (5.5 - 5.5)',
		tagline: 'Синхронизация сердца и мозга',
		description:
			'Дыхание с частотой ~5.5 циклов в минуту. Максимизирует вариабельность сердечного ритма (HRV) и вводит организм в состояние гармонии.',
		benefits: ['Гармонизирует ритм сердца', 'Балансирует давление', 'Убирает эмоциональный шум'],
		accentColor: '#38bdf8',
		bgGlow: 'rgba(56, 189, 248, 0.25)',
		totalCycleSeconds: 11,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Мягкий плавный вдох на 5.5 секунд',
				seconds: 5.5,
				color: '#38bdf8'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Такой же мягкий непрерывный выдох на 5.5 секунд',
				seconds: 5.5,
				color: '#0284c7'
			}
		]
	},
	{
		id: 'sigh',
		name: 'Физиологический вздох',
		tagline: 'Мгновенное снятие тревоги (Huberman Lab)',
		description:
			'Исследован Стэнфордским университетом. Два быстрых вдоха через нос расправляют альвеолы легких, а длинный выдох моментально снижает пульс.',
		benefits: ['Мгновенный сброс стресса за 1-2 минуты', 'Перезапуск альвеол легких', 'Снижает уровень возбуждения'],
		accentColor: '#f59e0b',
		bgGlow: 'rgba(245, 158, 11, 0.25)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Глубокий вдох',
				hint: 'Глубокий вдох через нос почти до максимума',
				seconds: 3.5,
				color: '#f59e0b'
			},
			{
				type: 'holdIn',
				name: 'Довдох',
				hint: 'Короткий резкий довдох носом до полного объема',
				seconds: 1.5,
				color: '#fbbf24'
			},
			{
				type: 'exhale',
				name: 'Длинный выдох',
				hint: 'Очень медленный, плавный и расслабленный выдох ртом',
				seconds: 7,
				color: '#d97706'
			}
		]
	},
	{
		id: 'awake',
		name: 'Энергия и бодрость (4-2-4)',
		tagline: 'Легкий подъем тонуса без кофеина',
		description:
			'Сбалансированный ритмичный паттерн насыщает кровь кислородом, прогоняет дневную сонливость и активизирует рабочее состояние.',
		benefits: ['Снимает сонливость', 'Освежает восприятие', 'Повышает кислородный обмен'],
		accentColor: '#fb7185',
		bgGlow: 'rgba(251, 113, 133, 0.25)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Активный уверенный вдох через нос',
				seconds: 4,
				color: '#fb7185'
			},
			{
				type: 'holdIn',
				name: 'Пауза',
				hint: 'Короткая пауза с полными легкими',
				seconds: 2,
				color: '#fda4af'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Полный выдох через нос или рот',
				seconds: 4,
				color: '#f43f5e'
			},
			{
				type: 'holdOut',
				name: 'Пауза',
				hint: 'Короткая пауза перед следующим вдохом',
				seconds: 2,
				color: '#e11d48'
			}
		]
	}
]
