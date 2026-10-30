import { type IFlashcard, extractFlashcards } from '@/components/editor/study'
import { createClient } from '@/lib/supabase/client'

/*
 * Карточки «вопрос :: ответ» из листов архива и их интервальное повторение
 * (упрощённый алгоритм SM-2, как в Anki). Карточки живут в тексте листов,
 * в базе — только прогресс по каждой.
 */

export type TypeGrade = 'again' | 'hard' | 'good' | 'easy'

export interface ICardState {
	card_id: string
	page_id: string
	due_at: string
	interval_days: number
	ease: number
	reps: number
	lapses: number
}

export interface IDeckCard extends IFlashcard {
	pageId: string
	pageTitle: string
	topicId: string
	state: ICardState | null
}

const DAY = 86_400_000

let client: ReturnType<typeof createClient> | null = null
const db = () => (client ??= createClient())

export const isDue = (card: IDeckCard, now = Date.now()) =>
	!card.state || new Date(card.state.due_at).getTime() <= now

export const isLearned = (card: IDeckCard) => (card.state?.interval_days ?? 0) >= 21

/** Следующее состояние карточки после оценки */
export function schedule(state: ICardState | null, grade: TypeGrade, now = Date.now()) {
	const reps = state?.reps ?? 0
	let interval = state?.interval_days ?? 0
	let ease = state?.ease ?? 2.5
	let lapses = state?.lapses ?? 0
	let nextReps = reps + 1
	let dueMs: number

	if (grade === 'again') {
		lapses += reps > 0 ? 1 : 0
		ease = Math.max(1.3, ease - 0.2)
		interval = 0
		nextReps = 0
		dueMs = now + 60_000
	} else {
		if (grade === 'hard') {
			interval = reps === 0 ? 0.5 : Math.max(1, interval * 1.2)
			ease = Math.max(1.3, ease - 0.15)
		} else if (grade === 'good') {
			interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, interval * ease)
		} else {
			interval = reps === 0 ? 4 : Math.max(interval + 2, interval * ease * 1.3)
			ease += 0.15
		}
		interval = Math.min(interval, 365)
		dueMs = now + interval * DAY
	}

	return {
		due_at: new Date(dueMs).toISOString(),
		interval_days: Math.round(interval * 100) / 100,
		ease: Math.round(ease * 100) / 100,
		reps: nextReps,
		lapses
	}
}

/** Подпись на кнопке: через сколько карточка вернётся */
export function formatInterval(state: ICardState | null, grade: TypeGrade) {
	const next = schedule(state, grade)
	const ms = new Date(next.due_at).getTime() - Date.now()
	if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} мин`
	if (ms < DAY) return `${Math.round(ms / 3_600_000)} ч`
	const days = Math.round(ms / DAY)
	if (days < 30) return `${days} дн`
	if (days < 365) return `${Math.round(days / 30)} мес`
	return `${Math.round(days / 365)} г`
}

export const flashcardsService = {
	async getDeck(): Promise<IDeckCard[]> {
		const [pages, states] = await Promise.all([
			db().from('library_page').select('id,topic_id,title,content'),
			db().from('flashcard_state').select('card_id,page_id,due_at,interval_days,ease,reps,lapses')
		])
		if (pages.error) throw new Error(pages.error.message)
		if (states.error) throw new Error(states.error.message)
		const byId = new Map((states.data as ICardState[]).map(state => [state.card_id, state]))
		const seen = new Set<string>()
		const deck: IDeckCard[] = []
		for (const page of pages.data || []) {
			for (const card of extractFlashcards(page.id, page.content || '')) {
				if (seen.has(card.id)) continue
				seen.add(card.id)
				deck.push({
					...card,
					pageId: page.id,
					pageTitle: page.title || 'Без названия',
					topicId: page.topic_id,
					state: byId.get(card.id) ?? null
				})
			}
		}
		return deck
	},

	async grade(card: IDeckCard, grade: TypeGrade) {
		const next = schedule(card.state, grade)
		const row = {
			card_id: card.id,
			page_id: card.pageId,
			...next,
			last_grade: ['again', 'hard', 'good', 'easy'].indexOf(grade),
			updated_at: new Date().toISOString()
		}
		const { error } = await db().from('flashcard_state').upsert(row, { onConflict: 'user_id,card_id' })
		if (error) throw new Error(error.message)
		return { card_id: card.id, page_id: card.pageId, ...next } as ICardState
	}
}
