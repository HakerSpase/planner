const MAX_IMAGE_SIZE = 10 * 1024 * 1024

interface IUploadAuth {
	token: string
	expire: number
	signature: string
	publicKey: string
	folder: string
	error?: string
}

// Загружает картинку напрямую в ImageKit и возвращает её публичный URL
export async function uploadImage(file: File): Promise<string> {
	if (!file.type.startsWith('image/')) {
		throw new Error('Можно загружать только изображения')
	}
	if (file.size > MAX_IMAGE_SIZE) {
		throw new Error('Фото больше 10 МБ')
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
	form.append('fileName', file.name || 'image')
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
		throw new Error(uploaded.message || 'Не удалось загрузить фото')
	}

	return uploaded.url
}
