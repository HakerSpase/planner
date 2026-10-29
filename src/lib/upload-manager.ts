import type { Editor } from '@tiptap/react'
import { toast } from 'sonner'

import { replaceImageSrc } from '@/components/editor/extensions'
import { uploadFile, uploadImage } from '@/lib/imagekit-upload'

import { createClient } from '@/lib/supabase/client'

/*
 * Загрузки живут на уровне приложения, а не редактора: закрыли заметку или ушли
 * в другой раздел — файл догружается. Пока идёт загрузка, в тексте заметки лежит
 * отметка <div data-planner-pending="blob:…">. По окончании:
 *  — если заметка открыта, редактор сам подменяет блок и сохраняет текст;
 *  — если закрыта, менеджер находит отметку в базе и подставляет готовый файл.
 */

export type TypeUploadKind = 'image' | 'file' | 'audio'

export type TypeUploadContext =
	| { type: 'task'; id: string }
	| { type: 'thought'; date: string }
	| { type: 'page'; id: string }

export interface IUploadItem {
	id: string
	preview: string
	name: string
	kind: TypeUploadKind
	progress: number
	status: 'uploading' | 'done' | 'error'
}

const items = new Map<string, IUploadItem>()
const listeners = new Set<() => void>()
const editors = new Set<Editor>()
const EMPTY: IUploadItem[] = []
let snapshot: IUploadItem[] = EMPTY

const emit = () => {
	snapshot = Array.from(items.values())
	listeners.forEach(listener => listener())
}

export const uploadStore = {
	subscribe(listener: () => void) {
		listeners.add(listener)
		return () => listeners.delete(listener)
	},
	getSnapshot: () => snapshot,
	getServerSnapshot: () => EMPTY
}

export function registerEditor(editor: Editor) {
	editors.add(editor)
	return () => editors.delete(editor)
}

const update = (id: string, patch: Partial<IUploadItem>) => {
	const item = items.get(id)
	if (!item) return
	items.set(id, { ...item, ...patch })
	emit()
}

const escapeAttr = (value: string) =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Готовая разметка файла для подстановки в сохранённый текст
function finalMarkup(kind: TypeUploadKind, url: string, file: File) {
	if (kind === 'image') return `![](${url})`
	const attr = kind === 'audio' ? 'data-planner-audio' : 'data-planner-file'
	return `<div ${attr} data-src="${escapeAttr(url)}" data-name="${escapeAttr(file.name)}" data-size="${file.size}" data-mime="${escapeAttr(file.type)}"></div>`
}

const db = () => createClient()

// Достаём текст заметки, меняем отметку загрузки на готовый файл (или убираем), сохраняем
async function patchStored(context: TypeUploadContext, preview: string, replacement: string) {
	const pattern = new RegExp(
		`<div data-planner-pending="${escapeRegExp(preview)}"[^>]*></div>`,
		'g'
	)
	const table =
		context.type === 'task' ? 'task' : context.type === 'thought' ? 'daily_thought' : 'library_page'
	const column = context.type === 'task' ? 'note' : 'content'

	// Автосохранение заметки могло ещё не дойти до базы — пробуем несколько раз
	for (let attempt = 0; attempt < 4; attempt++) {
		const query = db().from(table).select(column)
		const { data } =
			context.type === 'thought'
				? await query.eq('thought_date', context.date).maybeSingle()
				: await query.eq('id', context.id).maybeSingle()
		const text: string | undefined = (data as any)?.[column]
		if (text && pattern.test(text)) {
			const next = text.replace(pattern, replacement)
			const updateQuery = db()
				.from(table)
				.update({ [column]: next, ...(context.type === 'task' && { updated_at: new Date().toISOString() }) })
			if (context.type === 'thought') await updateQuery.eq('thought_date', context.date)
			else await updateQuery.eq('id', context.id)
			window.dispatchEvent(
				new CustomEvent('planner:note-patched', { detail: { context, content: next } })
			)
			return
		}
		await new Promise(resolve => setTimeout(resolve, 1500))
	}
}

// Открытый редактор, где лежит этот блок, подменяет его сам
async function applyToEditors(preview: string, src: string | null) {
	let handled = false
	for (const editor of Array.from(editors)) {
		if (editor.isDestroyed) continue
		let found = false
		editor.state.doc.descendants(node => {
			if (node.attrs?.src === preview) found = true
		})
		if (found) {
			handled = true
			await replaceImageSrc(editor, preview, src)
		}
	}
	return handled
}

export function startUpload(file: File, kind: TypeUploadKind, context?: TypeUploadContext) {
	const preview = URL.createObjectURL(file)
	const id = preview
	items.set(id, { id, preview, name: file.name || 'Файл', kind, progress: 0, status: 'uploading' })
	emit()

	const onProgress = (fraction: number) => update(id, { progress: fraction })

	;(async () => {
		try {
			const url =
				kind === 'image' ? await uploadImage(file, onProgress) : (await uploadFile(file, onProgress)).url
			const handled = await applyToEditors(preview, url)
			if (!handled && context) await patchStored(context, preview, finalMarkup(kind, url, file))
			update(id, { status: 'done', progress: 1 })
		} catch (error) {
			const handled = await applyToEditors(preview, null)
			if (!handled && context) await patchStored(context, preview, '').catch(() => {})
			update(id, { status: 'error' })
			toast.error(error instanceof Error ? error.message : 'Не удалось загрузить файл')
		} finally {
			// предпросмотр ещё может быть открыт в другой заметке — отпускаем чуть позже
			setTimeout(() => {
				URL.revokeObjectURL(preview)
				items.delete(id)
				emit()
			}, 4000)
		}
	})()

	return preview
}
