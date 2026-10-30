import { stripAnnotations } from '@/components/editor/annotations'
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

// Формулы в любых обозначениях: $$…$$, \[…\], \(…\), $…$ и «удвоенные» \\[…\\], \\(…\\)
const FORMULA =
	/\$\$([\s\S]+?)\$\$|\\\\\[([\s\S]+?)\\\\\]|\\\\\(([\s\S]+?)\\\\\)|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g

const unescapeMarkdown = (value: string) => value.replace(/\\([!-\/:-@\[-`{-~])/g, '$1')

// Короткий текст для превью: без разметки и вложений. Формулы остаются как $…$ —
// превью рисует их KaTeX'ом (MathExcerpt)
export const toExcerpt = (markdown: string, length = 220) => {
	const formulas: string[] = []
	const withoutFormulas = markdown.replace(
		FORMULA,
		(_match, ...groups: (string | undefined)[]) => {
			const index = groups.findIndex(group => group !== undefined)
			const body = index === 1 || index === 2 ? unescapeMarkdown(groups[index]!) : groups[index]!
			formulas.push(body.replace(/\s+/g, ' ').trim())
			return ` \u0000${formulas.length - 1}\u0000 `
		}
	)
	// Пометки {код|текст} в превью не нужны — только сам текст
	const text = stripAnnotations(withoutFormulas)
		.replace(/^```[\s\S]*?^```/gm, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		// [[Лист]] и [[Лист|подпись]] — подписью; ⟦…⟧ превью покажет как ссылку
		.replace(/\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g, (_match, title: string, label?: string) =>
			`⟦${(label || title).trim()}⟧`
		)
		// Метки выносок [!rule] и разделитель карточек
		.replace(/\[![a-zA-Zа-яёА-ЯЁ]+\][+-]?/g, ' ')
		.replace(/ :: /g, ' → ')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/^[#>\-*\s]+|\[[ x]]\s?|\|/gim, ' ')
		.replace(/[*_~`]/g, '')
		.replace(/\\([!-\/:-@\[-`{-~])/g, '$1')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, length)
		.replace(/\u0000\d*$/, '')
		.replace(/⟦[^⟧]*$/, '')
	return text.replace(/\u0000(\d+)\u0000/g, (_match, index) => `$${formulas[Number(index)]}$`)
}

/*
 * Новые разделы, темы и листы появляются на экране сразу: id задаём на клиенте,
 * а запись в базу идёт фоном. Любое действие с ещё не сохранённой записью
 * дожидается её создания.
 */
const pending = new Map<string, Promise<unknown>>()

export const newLibraryId = () => crypto.randomUUID()

const track = <T>(id: string, create: () => Promise<T>) => {
	const promise = create()
	pending.set(id, promise)
	promise.then(
		() => pending.delete(id),
		() => pending.delete(id)
	)
	return promise
}

const settled = async (id: string) => {
	await pending.get(id)?.catch(() => undefined)
}

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

	async createSection(id: string, title: string, order: number) {
		return track(id, async () =>
			unwrap<ILibrarySection>(
				await db()
					.from('library_section')
					.insert({ id, title, order })
					.select('id,title,order')
					.single()
			)
		)
	},

	async createTopic(id: string, sectionId: string, title: string, order: number) {
		await settled(sectionId)
		return track(id, async () =>
			unwrap<ILibraryTopic>(
				await db()
					.from('library_topic')
					.insert({ id, section_id: sectionId, title, order })
					.select('id,section_id,title,order')
					.single()
			)
		)
	},

	async createPage(id: string, topicId: string, order: number) {
		await settled(topicId)
		return track(id, async () =>
			unwrap<ILibraryPage>(
				await db()
					.from('library_page')
					.insert({ id, topic_id: topicId, title: '', content: '', order })
					.select('id,topic_id,title,order,updated_at,content')
					.single()
			)
		)
	},

	async rename(table: 'library_section' | 'library_topic', id: string, title: string) {
		await settled(id)
		unwrap(await db().from(table).update({ title }).eq('id', id))
	},

	async updatePage(id: string, patch: { title?: string; content?: string }) {
		await settled(id)
		return unwrap<{ updated_at: string }>(
			await db().from('library_page').update(patch).eq('id', id).select('updated_at').single()
		)
	},

	async remove(table: 'library_section' | 'library_topic' | 'library_page', id: string) {
		await settled(id)
		unwrap(await db().from(table).delete().eq('id', id))
	}
}
