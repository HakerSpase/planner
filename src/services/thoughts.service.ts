import { createClient } from '@/lib/supabase/client'

/* «Мысли» — напрямую в Supabase (RLS: только свои записи), без серверных функций Vercel */

export interface IThoughtRow {
	thought_date: string
	content: string
	mood?: number | null
	updated_at?: string
}

let client: ReturnType<typeof createClient> | null = null
const db = () => (client ??= createClient())

async function userId() {
	const { data } = await db().auth.getSession()
	const id = data.session?.user.id
	if (!id) throw new Error('Unauthorized')
	return id
}

export const thoughtsService = {
	async getRange(start: string, end: string): Promise<IThoughtRow[]> {
		const { data, error } = await db()
			.from('daily_thought')
			.select('thought_date,content,mood,updated_at')
			.gte('thought_date', start)
			.lte('thought_date', end)
			.order('thought_date')
		if (error) throw new Error(error.message)
		return data || []
	},

	async save(date: string, content: string): Promise<IThoughtRow> {
		const { data, error } = await db()
			.from('daily_thought')
			.upsert(
				{ user_id: await userId(), thought_date: date, content },
				{ onConflict: 'user_id,thought_date' }
			)
			.select('thought_date,content,mood,updated_at')
			.single()
		if (error) throw new Error(error.message)
		return data
	},

	// Только настроение — текст записи при этом не трогаем
	async saveMood(date: string, mood: number | null) {
		const { error } = await db()
			.from('daily_thought')
			.upsert(
				{ user_id: await userId(), thought_date: date, mood },
				{ onConflict: 'user_id,thought_date' }
			)
		if (error) throw new Error(error.message)
	}
}
