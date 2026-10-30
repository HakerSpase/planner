import {
	Flame,
	Footprints,
	type LucideIcon,
	Mountain,
	Snowflake,
	Timer,
	Wind,
	Zap
} from 'lucide-react'

/**
 * Программы — дыхание по сценарию: серии вдохов, задержки и отдых по раундам.
 * В отличие от циклов (квадрат, 4-7-8) здесь шаги разные и задержки записываются.
 */

interface IStepBase {
	round: number
	title: string
	hint: string
	/** Что сказать голосом в начале шага */
	voice?: string
}

export interface IBreathsStep extends IStepBase {
	kind: 'breaths'
	count: number
	inhale: number
	exhale: number
	/** deep — волной животом и грудью; bellows — «меха»; pump — резкие выдохи животом */
	style: 'deep' | 'bellows' | 'pump'
}

export interface IHoldStep extends IStepBase {
	kind: 'hold'
	lungs: 'in' | 'out'
	/** Без значения — держим, сколько комфортно, и жмём «Вдохнул» */
	seconds?: number
	/** Записать длительность в итоги раунда */
	record?: boolean
}

export interface IRestStep extends IStepBase {
	kind: 'rest'
	seconds: number
	/** Вдох или выдох для формы на экране */
	lungs?: 'in' | 'out'
}

export type ProtocolStep = IBreathsStep | IHoldStep | IRestStep

export interface IProtocol {
	id: string
	name: string
	shortName: string
	tagline: string
	icon: LucideIcon
	accent: string
	/** 1 — мягко, 2 — интенсивно, 3 — жёстко */
	intensity: 1 | 2 | 3
	/** Как делать — коротко, показывается до старта */
	howTo: string[]
	/** Нужен личный максимум задержки (таблицы фридайверов) */
	needsMax?: boolean
	/** Записанная задержка — главный показатель прогресса */
	metric: string
	build: (maxHold: number) => ProtocolStep[]
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

export const PROTOCOLS: IProtocol[] = [
	{
		id: 'wim-hof',
		name: 'Метод Вима Хофа — 3 раунда',
		shortName: 'Вим Хоф',
		tagline: '30 вдохов, задержка 30 → 60 → 90 с, восстановительный вдох',
		icon: Snowflake,
		accent: '#38bdf8',
		intensity: 3,
		metric: 'Задержка на выдохе',
		howTo: [
			'Сидя или лёжа. Вдох глубокий и волной: сначала живот, затем грудь.',
			'Выдох пассивный — просто отпусти воздух, не выдавливая до конца. Без пауз между вдохом и выдохом.',
			'После 30-го вдоха спокойно выдохни и держи пустые лёгкие. Таймер ведёт: 30, 60, 90 секунд. Не можешь — вдыхай раньше и жми «Вдохнул».',
			'Затем глубокий вдох и задержка 15 секунд, выдох — и следующий раунд.',
			'Покалывание, лёгкое головокружение и жар — нормальная реакция.'
		],
		build: () =>
			[30, 60, 90].flatMap((hold, i): ProtocolStep[] => [
				{
					kind: 'breaths',
					round: i + 1,
					count: 30,
					inhale: 2,
					exhale: 1.7,
					style: 'deep',
					title: 'Глубокое дыхание',
					hint: 'Вдох животом и грудью, выдох — просто отпусти',
					voice: `Раунд ${i + 1}. Тридцать глубоких вдохов`
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'out',
					seconds: hold,
					record: true,
					title: 'Задержка на выдохе',
					hint: 'Выдохни и держи. Расслабь плечи и лицо',
					voice: `Выдох. Задержка ${hold} секунд`
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'in',
					seconds: 15,
					title: 'Восстановительный вдох',
					hint: 'Глубокий вдох и задержка на полных лёгких',
					voice: 'Глубокий вдох. Держи пятнадцать секунд'
				},
				{
					kind: 'rest',
					round: i + 1,
					seconds: 5,
					lungs: 'out',
					title: 'Выдох',
					hint:
						i === 2
							? 'Возвращайся к спокойному дыханию'
							: 'Отпусти воздух — дальше следующий раунд',
					voice: i === 2 ? 'Выдох. Дыши спокойно' : 'Выдох'
				}
			])
	},
	{
		id: 'tummo',
		name: 'Туммо — «внутренний огонь»',
		shortName: 'Туммо',
		tagline: 'Быстрые вдохи, задержка до позыва и дыхание «сосуд»',
		icon: Flame,
		accent: '#f97316',
		intensity: 3,
		metric: 'Задержка на выдохе',
		howTo: [
			'Сидя с прямой спиной. 30 быстрых глубоких вдохов животом, около одного в секунду.',
			'Полный выдох и задержка на пустых лёгких — пока комфортно. Вдохнул — жми кнопку.',
			'«Сосуд»: глубокий вдох, сожми мышцы тазового дна и живота, будто запираешь воздух внизу живота, и держи 20 секунд.',
			'Всё это время представляй пламя чуть ниже пупка, которое разгорается и поднимается по позвоночнику — без образа эффект заметно слабее.'
		],
		build: () =>
			range(4).flatMap((i): ProtocolStep[] => [
				{
					kind: 'breaths',
					round: i + 1,
					count: 30,
					inhale: 1.3,
					exhale: 1.1,
					style: 'bellows',
					title: 'Быстрое дыхание',
					hint: 'Вдох животом, выдох свободный. Представь пламя под пупком',
					voice: `Раунд ${i + 1}. Тридцать быстрых вдохов`
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'out',
					record: true,
					title: 'Задержка до позыва',
					hint: 'Пустые лёгкие. Держи, пока комфортно, — потом жми «Вдохнул»',
					voice: 'Выдох и задержка. Держи, пока комфортно'
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'in',
					seconds: 20,
					title: 'Сосуд',
					hint: 'Глубокий вдох, сожми низ живота и тазовое дно. Пламя поднимается вверх',
					voice: 'Глубокий вдох. Сосуд. Сожми низ живота'
				},
				{
					kind: 'rest',
					round: i + 1,
					seconds: 6,
					lungs: 'out',
					title: 'Медленный выдох',
					hint: 'Отпусти напряжение и воздух',
					voice: 'Медленный выдох'
				}
			])
	},
	{
		id: 'bhastrika',
		name: 'Бхастрика — «кузнечные меха»',
		shortName: 'Бхастрика',
		tagline: 'Форсированные вдох и выдох, задержка на вдохе',
		icon: Wind,
		accent: '#ef4444',
		intensity: 2,
		metric: 'Задержка на вдохе',
		howTo: [
			'Через нос. И вдох, и выдох активные и одинаково сильные — работает живот, плечи неподвижны.',
			'Ритм ведёт форма на экране: примерно цикл в секунду.',
			'После серии — глубокий вдох и задержка на полных лёгких, затем медленный выдох и отдых.',
			'Закружилась голова — останови серию и подыши спокойно.'
		],
		build: () =>
			[20, 25, 30].flatMap((count, i): ProtocolStep[] => [
				{
					kind: 'breaths',
					round: i + 1,
					count,
					inhale: 0.6,
					exhale: 0.6,
					style: 'bellows',
					title: 'Меха',
					hint: 'Сильный вдох — сильный выдох, через нос',
					voice: `Раунд ${i + 1}. ${count} мехов`
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'in',
					seconds: [15, 20, 25][i],
					record: true,
					title: 'Задержка на вдохе',
					hint: 'Глубокий вдох и держи, подбородок чуть к груди',
					voice: 'Глубокий вдох и задержка'
				},
				{
					kind: 'rest',
					round: i + 1,
					seconds: 40,
					title: 'Отдых',
					hint: 'Медленный выдох, дальше спокойное дыхание',
					voice: 'Медленный выдох. Отдых'
				}
			])
	},
	{
		id: 'kapalabhati',
		name: 'Капалабхати — «сияющий череп»',
		shortName: 'Капалабхати',
		tagline: 'Резкие выдохи животом, вдох пассивный',
		icon: Zap,
		accent: '#eab308',
		intensity: 2,
		metric: 'Задержка на выдохе',
		howTo: [
			'Выдох — короткий толчок животом, будто задуваешь свечу носом. Вдох происходит сам, когда живот расслабляется.',
			'Около полутора толчков в секунду. Грудь и плечи неподвижны.',
			'После серии — полный выдох и короткая задержка, затем отдых.',
			'Не делай при беременности, грыжах, высоком давлении и после операций на животе.'
		],
		build: () =>
			[30, 45, 60].flatMap((count, i): ProtocolStep[] => [
				{
					kind: 'breaths',
					round: i + 1,
					count,
					inhale: 0.45,
					exhale: 0.25,
					style: 'pump',
					title: 'Толчки',
					hint: 'Резкий выдох животом, вдох сам',
					voice: `Раунд ${i + 1}. ${count} толчков`
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'out',
					seconds: [15, 20, 30][i],
					record: true,
					title: 'Задержка на выдохе',
					hint: 'Выдохни до конца и держи',
					voice: 'Полный выдох и задержка'
				},
				{
					kind: 'rest',
					round: i + 1,
					seconds: 30,
					title: 'Отдых',
					hint: 'Спокойное дыхание носом',
					voice: 'Вдох. Отдых'
				}
			])
	},
	{
		id: 'buteyko-walk',
		name: 'Бутейко — ходьба на задержке',
		shortName: 'Ходьба на задержке',
		tagline: 'Контрольная пауза и 6 задержек на ходу',
		icon: Footprints,
		accent: '#22c55e',
		intensity: 2,
		metric: 'Задержка с ходьбой',
		howTo: [
			'Противоположность Хофу: не продувать лёгкие, а привыкать к углекислому газу.',
			'Контрольная пауза: после обычного спокойного выдоха зажми нос и держи до первого позыва — не до предела. Меньше 20 с — плохо, 20–40 — средне, больше 40 — хорошо.',
			'Ходьба: выдохни, зажми нос и иди, считая шаги, до сильного позыва. Вдохнул — жми кнопку. Восстанови дыхание носом за минуту.',
			'Цель со временем — 80–100 шагов. Дыши только носом, в том числе в отдыхе.'
		],
		build: () => [
			{
				kind: 'hold',
				round: 0,
				lungs: 'out',
				record: true,
				title: 'Контрольная пауза',
				hint: 'Обычный выдох, зажми нос. Жми при первом желании вдохнуть',
				voice: 'Контрольная пауза. Спокойный выдох, зажми нос'
			},
			...range(6).flatMap((i): ProtocolStep[] => [
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'out',
					record: true,
					title: 'Иди и считай шаги',
					hint: 'Выдохни, зажми нос и иди. Вдохнул — жми кнопку',
					voice: `Задержка ${i + 1}. Выдох, зажми нос и иди`
				},
				{
					kind: 'rest',
					round: i + 1,
					seconds: 60,
					title: 'Восстановление',
					hint: 'Остановись. Спокойно и тихо дыши только носом',
					voice: 'Дыши носом, спокойно'
				}
			]),
			{
				kind: 'hold',
				round: 7,
				lungs: 'out',
				record: true,
				title: 'Контрольная пауза',
				hint: 'Снова до первого позыва — сравни с началом',
				voice: 'Контрольная пауза. До первого позыва'
			}
		]
	},
	{
		id: 'co2-table',
		name: 'CO₂-таблица фридайвера',
		shortName: 'CO₂-таблица',
		tagline: 'Задержка постоянная, отдых сокращается: 2:00 → 0:15',
		icon: Timer,
		accent: '#a855f7',
		intensity: 3,
		needsMax: true,
		metric: 'Задержка на вдохе',
		howTo: [
			'Учит терпеть высокий углекислый газ. Все 8 задержек — половина твоего максимума.',
			'Отдых между ними сокращается на 15 секунд: от двух минут до пятнадцати секунд.',
			'Перед задержкой — обычный вдох, без гипервентиляции: она убирает сигнал «пора дышать».',
			'Только лёжа или сидя на суше. Не больше одной таблицы в день, CO₂ и O₂ — в разные дни.'
		],
		build: max => {
			const hold = Math.max(15, Math.round((max * 0.5) / 5) * 5)
			return range(8).flatMap((i): ProtocolStep[] => [
				{
					kind: 'rest',
					round: i + 1,
					seconds: 120 - i * 15,
					title: 'Отдых',
					hint: 'Спокойное дыхание, без глубоких вдохов',
					voice: i ? 'Дыши спокойно' : 'Спокойное дыхание'
				},
				{
					kind: 'hold',
					round: i + 1,
					lungs: 'in',
					seconds: hold,
					record: true,
					title: `Задержка ${i + 1} из 8`,
					hint: 'Обычный полный вдох и держи. Расслабь тело',
					voice: `Вдох и задержка ${i + 1}`
				}
			])
		}
	},
	{
		id: 'o2-table',
		name: 'O₂-таблица фридайвера',
		shortName: 'O₂-таблица',
		tagline: 'Отдых 2:00, задержка растёт от 40% до 80% максимума',
		icon: Mountain,
		accent: '#6366f1',
		intensity: 3,
		needsMax: true,
		metric: 'Задержка на вдохе',
		howTo: [
			'Учит организм дольше обходиться без кислорода. Отдых всегда 2 минуты.',
			'Задержка растёт с каждым раундом: от 40% до 80% твоего максимума.',
			'Перед задержкой — обычный вдох, без гипервентиляции.',
			'Только лёжа или сидя на суше. Стало темнеть в глазах — сразу дыши.'
		],
		build: max =>
			range(8).flatMap((i): ProtocolStep[] => {
				const hold = Math.max(
					10,
					Math.round((max * (0.4 + (0.4 * i) / 7)) / 5) * 5
				)
				return [
					{
						kind: 'rest',
						round: i + 1,
						seconds: 120,
						title: 'Отдых',
						hint: 'Спокойное дыхание, без глубоких вдохов',
						voice: 'Дыши спокойно'
					},
					{
						kind: 'hold',
						round: i + 1,
						lungs: 'in',
						seconds: hold,
						record: true,
						title: `Задержка ${i + 1} из 8`,
						hint: 'Обычный полный вдох и держи. Расслабь тело',
						voice: `Вдох и задержка ${hold} секунд`
					}
				]
			})
	},
	{
		id: 'max-hold',
		name: 'Замер максимума задержки',
		shortName: 'Замер максимума',
		tagline: 'Для CO₂/O₂-таблиц: 2 минуты покоя и одна задержка',
		icon: Timer,
		accent: '#94a3b8',
		intensity: 2,
		metric: 'Максимум',
		howTo: [
			'Сядь или ляг, расслабься. Две минуты дыши спокойно — без глубоких вдохов.',
			'Затем обычный полный вдох и держи, пока можешь без героизма. Вдохнул — жми кнопку.',
			'Результат сохранится и станет основой для CO₂- и O₂-таблиц.'
		],
		build: () => [
			{
				kind: 'rest',
				round: 0,
				seconds: 120,
				title: 'Покой',
				hint: 'Спокойное дыхание, тело расслаблено',
				voice: 'Две минуты спокойного дыхания'
			},
			{
				kind: 'hold',
				round: 1,
				lungs: 'in',
				record: true,
				title: 'Максимальная задержка',
				hint: 'Обычный полный вдох и держи. Вдохнул — жми кнопку',
				voice: 'Вдох и задержка. Держи, сколько можешь'
			}
		]
	}
]

export const MAX_HOLD_KEY = 'planner_breathing_max_hold'

export const findProtocol = (id: string) =>
	PROTOCOLS.find(protocol => protocol.id === id)

/** Сколько длится программа (для задержек «до позыва» — примерная оценка) */
export function estimateSeconds(steps: ProtocolStep[]) {
	return steps.reduce((sum, step) => {
		if (step.kind === 'breaths')
			return sum + step.count * (step.inhale + step.exhale)
		if (step.kind === 'hold') return sum + (step.seconds ?? 60)
		return sum + step.seconds
	}, 0)
}
