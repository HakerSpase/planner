const MAX_IMAGE_SIZE = 10 * 1024 * 1024

interface IUploadAuth {
	token: string
	expire: number
	signature: string
	publicKey: string
	folder: string
	error?: string
}

const MAX_SIDE = 2000

// Фото с телефона весят по 5–10 МБ — уменьшаем до 2000 px по длинной стороне и
// перекодируем в WebP перед отправкой. GIF/SVG и мелкие картинки отправляем как есть.
async function compressImage(file: File): Promise<File> {
	const resizable = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
	if (!resizable.includes(file.type) || file.size < 400 * 1024) {
		return file
	}
	try {
		const bitmap = await createImageBitmap(file)
		const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(bitmap.width * scale)
		canvas.height = Math.round(bitmap.height * scale)
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
		bitmap.close()
		const blob = await new Promise<Blob | null>(resolve =>
			canvas.toBlob(resolve, 'image/webp', 0.85)
		)
		if (!blob || blob.size >= file.size) return file
		const name = file.name.replace(/\.[^.]+$/, '') || 'image'
		return new File([blob], `${name}.webp`, { type: 'image/webp' })
	} catch {
		return file
	}
}

export interface IUploadedFile {
	url: string
	name: string
	size: number
	mime: string
}

const MAX_FILE_SIZE = 25 * 1024 * 1024

// Прямая загрузка в ImageKit по одноразовой подписи с нашего сервера
async function uploadToImageKit(file: File): Promise<IUploadedFile> {
	if (file.size > MAX_FILE_SIZE) {
		throw new Error('Файл больше 25 МБ')
	}

	const authResponse = await fetch('/api/upload/imagekit', {
		cache: 'no-store',
		credentials: 'include'
	})
	const auth: IUploadAuth = await authResponse.json()
	if (!authResponse.ok) {
		throw new Error(auth.error || 'Не удалось подготовить загрузку')
	}

	const form = new FormData()
	form.append('file', file)
	form.append('fileName', file.name || 'file')
	form.append('publicKey', auth.publicKey)
	form.append('signature', auth.signature)
	form.append('expire', String(auth.expire))
	form.append('token', auth.token)
	form.append('folder', auth.folder)
	form.append('useUniqueFileName', 'true')

	const uploadResponse = await fetch(
		'https://upload.imagekit.io/api/v1/files/upload',
		{ method: 'POST', body: form }
	)
	const uploaded = await uploadResponse.json()
	if (!uploadResponse.ok || typeof uploaded.url !== 'string') {
		throw new Error(uploaded.message || 'Не удалось загрузить файл')
	}

	return {
		url: uploaded.url,
		name: file.name || 'Файл',
		size: file.size,
		mime: file.type || 'application/octet-stream'
	}
}

// Картинка: сжимаем, грузим и возвращаем URL облегчённой версии для показа
export async function uploadImage(original: File): Promise<string> {
	if (!original.type.startsWith('image/')) {
		throw new Error('Можно загружать только изображения')
	}
	const file = await compressImage(original)
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error('Фото больше 10 МБ')
	}
	const uploaded = await uploadToImageKit(file)
	// ImageKit отдаёт картинку уже нужной ширины и в лёгком формате (WebP/AVIF)
	return `${uploaded.url}?tr=w-1600,q-80`
}

// Любой другой файл (документ, аудио, голосовое) — как есть
export const uploadFile = (file: File) => uploadToImageKit(file)

// Удалить файлы из ImageKit (по адресам). keepalive — чтобы запрос ушёл даже при закрытии страницы
export function deleteUploads(urls: string[]) {
	if (!urls.length) return
	fetch('/api/upload/imagekit', {
		method: 'DELETE',
		credentials: 'include',
		keepalive: true,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ urls })
	}).catch(() => {})
}
