import { createClient } from '@/lib/supabase/client'

/*
 * Архив работает с Supabase напрямую из браузера (доступ защищён RLS),
 * поэтому не тратит вызовы серверных функций Vercel.
 */

export interface ILibrarySection {
	id: string
	title: string
	order: number
}

export interface ILibraryTopic {
	id: string
	section_id: string
	title: string
	order: number
}

export interface ILibraryPageMeta {
	id: string
	topic_id: string
	title: string
	order: number
	updated_at: string
	excerpt: string
}

export interface ILibraryPage extends ILibraryPageMeta {
	content: string
}

let client: ReturnType<typeof createClient> | null = null
const db = () => (client ??= createClient())

const unwrap = <T>({ data, error }: { data: T | null; error: { message: string } | null }) => {
	if (error) throw new Error(error.message)
	return data as T
}

// Короткий текст для превью карточки листа: без разметки, формул и вложений
export const toExcerpt = (markdown: string) =>
	markdown
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\$\$[\s\S]*?\$\$/g, ' ∑ ')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/^[#>\-*\s]+|\[[ x]]\s?|\|/gim, ' ')
		.replace(/[*_~`]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 220)

export const libraryService = {
	async getTree() {
		const [sections, topics] = await Promise.all([
			db().from('library_section').select('id,title,order').order('order').order('created_at'),
			db()
				.from('library_topic')
				.select('id,section_id,title,order')
				.order('order')
				.order('created_at')
		])
		return {
			sections: unwrap<ILibrarySection[]>(sections) || [],
			topics: unwrap<ILibraryTopic[]>(topics) || []
		}
	},

	async getPages(topicId: string): Promise<ILibraryPageMeta[]> {
		// Контент целиком не тянем — только начало для превью
		const rows = unwrap<(Omit<ILibraryPageMeta, 'excerpt'> & { content: string })[]>(
			await db()
				.from('library_page')
				.select('id,topic_id,title,order,updated_at,content')
				.eq('topic_id', topicId)
				.order('order')
				.order('created_at')
		)
		return (rows || []).map(({ content, ...row }) => ({
			...row,
			excerpt: toExcerpt(content.slice(0, 1500))
		}))
	},

	// Всё для поиска разом: названия и тексты листов (личный архив — объём небольшой)
	async getSearchIndex() {
		return (
			unwrap<{ id: string; topic_id: string; title: string; content: string }[]>(
				await db().from('library_page').select('id,topic_id,title,content')
			) || []
		)
	},

	async getPage(id: string): Promise<ILibraryPage> {
		const row = unwrap<Omit<ILibraryPage, 'excerpt'>>(
			await db()
				.from('library_page')
				.select('id,topic_id,title,order,updated_at,content')
				.eq('id', id)
				.single()
		)
		return { ...row, excerpt: toExcerpt(row.content.slice(0, 1500)) }
	},

	async createSection(title: string, order: number) {
		return unwrap<ILibrarySection>(
			await db().from('library_section').insert({ title, order }).select('id,title,order').single()
		)
	},

	async createTopic(sectionId: string, title: string, order: number) {
		return unwrap<ILibraryTopic>(
			await db()
				.from('library_topic')
				.insert({ section_id: sectionId, title, order })
				.select('id,section_id,title,order')
				.single()
		)
	},

	async createPage(topicId: string, order: number) {
		return unwrap<ILibraryPage>(
			await db()
				.from('library_page')
				.insert({ topic_id: topicId, title: '', content: '', order })
				.select('id,topic_id,title,order,updated_at,content')
				.single()
		)
	},

	async rename(table: 'library_section' | 'library_topic', id: string, title: string) {
		unwrap(await db().from(table).update({ title }).eq('id', id))
	},

	async updatePage(id: string, patch: { title?: string; content?: string }) {
		return unwrap<{ updated_at: string }>(
			await db().from('library_page').update(patch).eq('id', id).select('updated_at').single()
		)
	},

	async remove(table: 'library_section' | 'library_topic' | 'library_page', id: string) {
		unwrap(await db().from(table).delete().eq('id', id))
	}
}
