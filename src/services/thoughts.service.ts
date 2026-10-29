import { createClient } from '@/lib/supabase/client'

/* «Мысли» — напрямую в Supabase (RLS: только свои записи), без серверных функций Vercel */

export interface IThoughtRow {
	thought_date: string
	content: string
	updated_at?: string
}

let client: ReturnType<typeof createClient> | null = null
const db = () => (client ??= createClient())

export const thoughtsService = {
	async getRange(start: string, end: string): Promise<IThoughtRow[]> {
		const { data, error } = await db()
			.from('daily_thought')
			.select('thought_date,content,updated_at')
			.gte('thought_date', start)
			.lte('thought_date', end)
			.order('thought_date')
		if (error) throw new Error(error.message)
		return data || []
	},

	async save(date: string, content: string): Promise<IThoughtRow> {
		const { data: session } = await db().auth.getSession()
		const userId = session.session?.user.id
		if (!userId) throw new Error('Unauthorized')
		const { data, error } = await db()
			.from('daily_thought')
			.upsert(
				{ user_id: userId, thought_date: date, content },
				{ onConflict: 'user_id,thought_date' }
			)
			.select('thought_date,content,updated_at')
			.single()
		if (error) throw new Error(error.message)
		return data
	}
}
