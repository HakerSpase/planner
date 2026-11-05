import { createClient } from '@/lib/supabase/client'

import { libraryService } from './library.service'

/*
 * Общий доступ к разделам и подразделам и копирование чужого листа к себе.
 * Читать можно без входа (функции базы отдают только то, что входит в ссылку),
 * копирование идёт обычными вставками в свой архив.
 */

export type TypeBundleKind = 'section' | 'topics'

export interface IBundleRow {
	token: string
	kind: TypeBundleKind
	section_id: string
	topic_ids: string[] | null
	allow_copy: boolean
}

export interface IBundlePage {
	id: string
	title: string
	updated_at: string
}

export interface IBundleTopic {
	id: string
	title: string
	pages: IBundlePage[]
}

export interface IBundle {
	kind: TypeBundleKind
	allow_copy: boolean
	section_title: string
	topics: IBundleTopic[]
}

export interface ISharedContent {
	id: string
	title: string
	content: string
	updated_at: string
}

const db = () => createClient()

const COPY_CHUNK = 20

export const AFTER_LOGIN_KEY = 'planner:after-login'

export const libraryShareService = {
	/* ---------- Владелец ссылки ---------- */

	async getBundleRow(sectionId: string, kind: TypeBundleKind) {
		const { data, error } = await db()
			.from('library_share_bundle')
			.select('token,kind,section_id,topic_ids,allow_copy')
			.eq('section_id', sectionId)
			.eq('kind', kind)
			.maybeSingle()
		if (error) throw new Error(error.message)
		return data as IBundleRow | null
	},

	async createBundle(row: Omit<IBundleRow, 'token'>) {
		const { data, error } = await db()
			.from('library_share_bundle')
			.insert(row)
			.select('token,kind,section_id,topic_ids,allow_copy')
			.single()
		if (error) throw new Error(error.message)
		return data as IBundleRow
	},

	async updateBundle(
		token: string,
		patch: Partial<Pick<IBundleRow, 'topic_ids' | 'allow_copy'>>
	) {
		const { error } = await db()
			.from('library_share_bundle')
			.update(patch)
			.eq('token', token)
		if (error) throw new Error(error.message)
	},

	async removeBundle(token: string) {
		const { error } = await db()
			.from('library_share_bundle')
			.delete()
			.eq('token', token)
		if (error) throw new Error(error.message)
	},

	async getPageAllowCopy(pageId: string) {
		const { data, error } = await db().rpc('get_page_share_allow_copy', {
			p_page_id: pageId
		})
		if (error) throw new Error(error.message)
		return Boolean(data)
	},

	async setPageAllowCopy(pageId: string, allow: boolean) {
		const { error } = await db().rpc('set_page_share_allow_copy', {
			p_page_id: pageId,
			p_allow: allow
		})
		if (error) throw new Error(error.message)
	},

	/* ---------- Кто открыл ссылку ---------- */

	async getBundle(token: string) {
		const { data, error } = await db().rpc('get_shared_bundle', {
			p_token: token
		})
		if (error) throw new Error(error.message)
		return (data as IBundle | null) ?? null
	},

	async getBundlePages(token: string, pageIds: string[]) {
		const { data, error } = await db().rpc('get_shared_bundle_pages', {
			p_token: token,
			p_page_ids: pageIds
		})
		if (error) throw new Error(error.message)
		return (data || []) as ISharedContent[]
	},

	/** Ссылка на лист: можно ли добавить его к себе. База ещё не обновлена — считаем, что нельзя */
	async getSharedPageAllowCopy(token: string) {
		const { data, error } = await db().rpc('get_shared_page_allow_copy', {
			p_token: token
		})
		return error ? false : Boolean(data)
	},

	async isSignedIn() {
		const { data } = await db().auth.getSession()
		return Boolean(data.session)
	},

	/* ---------- Копирование к себе ---------- */

	async ensureSection(target: { id?: string; newTitle?: string }) {
		if (target.id) return target.id
		const id = crypto.randomUUID()
		const { sections } = await libraryService.getTree()
		await libraryService.createSection(
			id,
			(target.newTitle || 'Новый раздел').slice(0, 200),
			sections.length
		)
		return id
	},

	async ensureTopic(sectionId: string, target: { id?: string; newTitle?: string }) {
		if (target.id) return target.id
		const id = crypto.randomUUID()
		const { topics } = await libraryService.getTree()
		await libraryService.createTopic(
			id,
			sectionId,
			(target.newTitle || 'Новая тема').slice(0, 200),
			topics.filter(topic => topic.section_id === sectionId).length
		)
		return id
	},

	/** Положить листы в свою тему; возвращает id первого */
	async copyPages(
		topicId: string,
		pages: { title: string; content: string }[],
		startOrder = 0
	) {
		const rows = pages.map((page, index) => ({
			id: crypto.randomUUID(),
			topic_id: topicId,
			title: (page.title || '').slice(0, 300),
			content: page.content || '',
			order: startOrder + index
		}))
		if (rows.length) {
			const { error } = await db().from('library_page').insert(rows)
			if (error) throw new Error(error.message)
		}
		return rows[0]?.id as string | undefined
	},

	/** Вся ссылка целиком: подразделы становятся новыми темами выбранного раздела */
	async copyBundle(
		token: string,
		bundle: IBundle,
		sectionId: string,
		onProgress?: (done: number, total: number) => void
	) {
		const total = bundle.topics.reduce((sum, topic) => sum + topic.pages.length, 0)
		let done = 0
		let first: { topic: string; page?: string } | null = null
		for (const topic of bundle.topics) {
			const topicId = await this.ensureTopic(sectionId, { newTitle: topic.title })
			first ??= { topic: topicId }
			for (let i = 0; i < topic.pages.length; i += COPY_CHUNK) {
				const chunk = topic.pages.slice(i, i + COPY_CHUNK)
				const contents = await this.getBundlePages(
					token,
					chunk.map(page => page.id)
				)
				const byId = new Map(contents.map(item => [item.id, item]))
				const firstId = await this.copyPages(
					topicId,
					chunk.map(page => ({
						title: page.title,
						content: byId.get(page.id)?.content || ''
					})),
					i
				)
				if (first && !first.page && first.topic === topicId) first.page = firstId
				done += chunk.length
				onProgress?.(done, total)
			}
		}
		return first
	}
}
