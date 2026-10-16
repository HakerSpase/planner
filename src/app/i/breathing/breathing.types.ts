import {
	Activity,
	Flame,
	Heart,
	Moon,
	Sparkles,
	Square,
	Triangle,
	Zap,
	type LucideIcon
} from 'lucide-react'

export type BreathingPhaseType = 'inhale' | 'holdIn' | 'exhale' | 'holdOut'

export type SoundscapeType = 'none' | 'rain' | 'waves' | 'forest' | 'brown_noise'
export type CueStyleType = 'tibetan' | 'bell' | 'soft_sine' | 'none'

export interface ISoundscapeOption {
	id: SoundscapeType
	label: string
	description: string
}

export interface ICueStyleOption {
	id: CueStyleType
	label: string
	description: string
}

export const SOUNDSCAPE_OPTIONS: ISoundscapeOption[] = [
	{ id: 'none', label: 'Без фона', description: 'Тишина без фонового звука' },
	{ id: 'rain', label: 'Шум дождя', description: 'Мягкие капли за окном' },
	{ id: 'waves', label: 'Океанские волны', description: 'Мерный ритмичный прибой' },
	{ id: 'forest', label: 'Лесной шелест', description: 'Шёпот деревьев и ветра' },
	{ id: 'brown_noise', label: 'Глубокий шум', description: 'Коричневый шум для снятия тревоги' }
]

export const CUE_STYLE_OPTIONS: ICueStyleOption[] = [
	{ id: 'tibetan', label: 'Поющая чаша', description: 'Глубокий тибетский резонанс' },
	{ id: 'bell', label: 'Мягкий колокол', description: 'Чистый гармоничный тон 528 Гц' },
	{ id: 'soft_sine', label: 'Мягкий сигнал', description: 'Медитативный тон 432 Гц' },
	{ id: 'none', label: 'Без звука фаз', description: 'Только вибрация' }
]

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
	shortName: string
	tagline: string
	description: string
	icon: LucideIcon
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
		shortName: 'Квадрат 4-4',
		tagline: 'Равномерный цикл для спокойствия и концентрации',
		description:
			'Классический цикл из четырёх равных фаз по 4 секунды: вдох, задержка, выдох и пауза. Помогает восстановить контроль и снять напряжение.',
		icon: Square,
		benefits: ['Снимает напряжение', 'Возвращает концентрацию', 'Выравнивает дыхание'],
		accentColor: '#10b981',
		bgGlow: 'rgba(16, 185, 129, 0.3)',
		totalCycleSeconds: 16,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Вдох носом',
				seconds: 4,
				color: '#10b981'
			},
			{
				type: 'holdIn',
				name: 'Задержка',
				hint: 'Задержка дыхания',
				seconds: 4,
				color: '#34d399'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Плавный выдох',
				seconds: 4,
				color: '#059669'
			},
			{
				type: 'holdOut',
				name: 'Пауза',
				hint: 'Пауза на выдохе',
				seconds: 4,
				color: '#047857'
			}
		]
	},
	{
		id: '4-7-8',
		name: 'Техника 4-7-8',
		shortName: 'Сон 4-7-8',
		tagline: 'Замедление пульса и подготовка ко сну',
		description:
			'Короткий вдох на 4 секунды, удержание на 7 секунд и долгий спокойный выдох на 8 секунд. Помогает телу переключиться в режим отдыха.',
		icon: Moon,
		benefits: ['Помогает уснуть', 'Снижает тревожность', 'Замедляет сердечный ритм'],
		accentColor: '#818cf8',
		bgGlow: 'rgba(129, 140, 248, 0.3)',
		totalCycleSeconds: 19,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Спокойный вдох носом',
				seconds: 4,
				color: '#818cf8'
			},
			{
				type: 'holdIn',
				name: 'Задержка',
				hint: 'Задержка дыхания',
				seconds: 7,
				color: '#a5b4fc'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Длинный медленный выдох',
				seconds: 8,
				color: '#6366f1'
			}
		]
	},
	{
		id: 'coherence',
		name: 'Когерентное дыхание (5.5с)',
		shortName: 'Баланс 5.5с',
		tagline: 'Плавный медитативный ритм',
		description:
			'Непрерывное мягкое дыхание: 5.5 секунд вдох и 5.5 секунд выдох. Выравнивает пульс и ритм дыхания.',
		icon: Activity,
		benefits: ['Ровный пульс', 'Эмоциональный баланс', 'Мягкое расслабление'],
		accentColor: '#38bdf8',
		bgGlow: 'rgba(56, 189, 248, 0.3)',
		totalCycleSeconds: 11,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Плавный вдох',
				seconds: 5.5,
				color: '#38bdf8'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Плавный выдох',
				seconds: 5.5,
				color: '#0284c7'
			}
		]
	},
	{
		id: 'sigh',
		name: 'Физиологический вздох',
		shortName: 'Сброс стресса',
		tagline: 'Быстрый сброс острого напряжения',
		description:
			'Двойной вдох (основной плюс короткий добор) и медленный длинный выдох. Самый быстрый способ сбросить волнение.',
		icon: Zap,
		benefits: ['Быстрое успокоение', 'Расслабление диафрагмы', 'Снижение пульса'],
		accentColor: '#f59e0b',
		bgGlow: 'rgba(245, 158, 11, 0.3)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Глубокий вдох',
				seconds: 3.5,
				color: '#f59e0b'
			},
			{
				type: 'holdIn',
				name: 'Добор',
				hint: 'Короткий довдох',
				seconds: 1.5,
				color: '#fbbf24'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Длинный спокойный выдох',
				seconds: 7,
				color: '#d97706'
			}
		]
	},
	{
		id: 'awake',
		name: 'Бодрость (4-2-4)',
		shortName: 'Тонус 4-2',
		tagline: 'Ритмичный цикл для включения в работу',
		description:
			'Энергичный ритм дыхания для насыщения кислородом и быстрого снятия дневной сонливости.',
		icon: Flame,
		benefits: ['Снимает сонливость', 'Повышает тонус', 'Освежает внимание'],
		accentColor: '#fb7185',
		bgGlow: 'rgba(251, 113, 133, 0.3)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Уверенный вдох',
				seconds: 4,
				color: '#fb7185'
			},
			{
				type: 'holdIn',
				name: 'Пауза',
				hint: 'Пауза на вдохе',
				seconds: 2,
				color: '#fda4af'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Полный выдох',
				seconds: 4,
				color: '#f43f5e'
			},
			{
				type: 'holdOut',
				name: 'Пауза',
				hint: 'Пауза перед вдохом',
				seconds: 2,
				color: '#e11d48'
			}
		]
	},
	{
		id: '4-2-6',
		name: 'Анти-тревога (4-2-6)',
		shortName: 'Релакс 4-2-6',
		tagline: 'Удлинённый выдох для быстрой перезагрузки нервной системы',
		description:
			'Вдох на 4 секунды, мягкая задержка на 2 секунды и медленный выдох на 6 секунд. Удлинённый выдох стимулирует блуждающий нерв, снижает пульс и снимает стресс.',
		icon: Heart,
		benefits: ['Снижает пульс', 'Снимает тревожность и панику', 'Активирует блуждающий нерв'],
		accentColor: '#14b8a6',
		bgGlow: 'rgba(20, 184, 166, 0.3)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Глубокий спокойный вдох',
				seconds: 4,
				color: '#14b8a6'
			},
			{
				type: 'holdIn',
				name: 'Пауза',
				hint: 'Мягкая задержка',
				seconds: 2,
				color: '#2dd4bf'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Длинный плавный выдох',
				seconds: 6,
				color: '#0d9488'
			}
		]
	},
	{
		id: 'triangle',
		name: 'Треугольное дыхание (4-4-4)',
		shortName: 'Треугольник 4-4',
		tagline: 'Йогическая пранаяма для баланса и чистой концентрации',
		description:
			'Трёхфазный цикл: равный вдох, задержка и выдох без паузы внизу. Легче переносится, чем квадрат, помогает быстро войти в состояние фокуса и ясного ума.',
		icon: Triangle,
		benefits: ['Ясность мышления', 'Плавная концентрация', 'Комфорт без паузы на выдохе'],
		accentColor: '#3b82f6',
		bgGlow: 'rgba(59, 130, 246, 0.3)',
		totalCycleSeconds: 12,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Осознанный ровный вдох',
				seconds: 4,
				color: '#3b82f6'
			},
			{
				type: 'holdIn',
				name: 'Задержка',
				hint: 'Задержка с полными лёгкими',
				seconds: 4,
				color: '#60a5fa'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Спокойный равномерный выдох',
				seconds: 4,
				color: '#2563eb'
			}
		]
	},
	{
		id: 'zen',
		name: 'Глубокий дзен (4-4-8)',
		shortName: 'Дзен 4-4-8',
		tagline: 'Максимальное вечернее расслабление после тяжелого дня',
		description:
			'Вдох на 4 секунды, задержка на 4 секунды и вдвое более длинный выдох на 8 секунд. Освобождает голову от мысленного шума, расслабляет мышцы лица и настраивает на глубокий сон.',
		icon: Sparkles,
		benefits: ['Снимает ментальный шум', 'Глубокое расслабление тела', 'Подготовка к медитации'],
		accentColor: '#a855f7',
		bgGlow: 'rgba(168, 85, 247, 0.3)',
		totalCycleSeconds: 16,
		phases: [
			{
				type: 'inhale',
				name: 'Вдох',
				hint: 'Плавный вдох носом',
				seconds: 4,
				color: '#a855f7'
			},
			{
				type: 'holdIn',
				name: 'Пауза',
				hint: 'Мягкая задержка',
				seconds: 4,
				color: '#c084fc'
			},
			{
				type: 'exhale',
				name: 'Выдох',
				hint: 'Очень долгий мягкий выдох',
				seconds: 8,
				color: '#9333ea'
			}
		]
	}
]
