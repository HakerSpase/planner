import { createHmac, randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Подпись для прямой загрузки из браузера в ImageKit.
// Приватный ключ остаётся на сервере, клиент получает одноразовую подпись на 10 минут.
export async function GET() {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
	const publicKey = process.env.IMAGEKIT_PUBLIC_KEY
	const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

	if (!privateKey || !publicKey || !urlEndpoint) {
		return NextResponse.json(
			{ error: 'Загрузка фото не настроена' },
			{ status: 503 }
		)
	}

	const token = randomUUID()
	const expire = Math.floor(Date.now() / 1000) + 10 * 60
	const signature = createHmac('sha1', privateKey)
		.update(token + expire)
		.digest('hex')

	return NextResponse.json(
		{
			token,
			expire,
			signature,
			publicKey,
			folder: `/planner/${user.id}`
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	)
}

// Удаление файлов, которые убрали из заметок. Удалить можно только из своей папки.
export async function DELETE(request: Request) {
	const supabase = createClient()
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser()

	if (authError || !user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
	const urlEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, '')
	if (!privateKey || !urlEndpoint) {
		return NextResponse.json({ error: 'Не настроено' }, { status: 503 })
	}

	const body = await request.json().catch(() => ({}))
	const urls: string[] = Array.isArray(body.urls) ? body.urls.slice(0, 20) : []
	const folder = `/planner/${user.id}/`
	const auth = `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`

	let deleted = 0
	for (const url of urls) {
		if (typeof url !== 'string') continue
		const path = url.split('?')[0].replace(urlEndpoint, '')
		if (!path.startsWith(folder) || path.includes('..')) continue
		const name = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
		const dir = path.slice(0, path.lastIndexOf('/') + 1)

		const search = await fetch(
			`https://api.imagekit.io/v1/files?path=${encodeURIComponent(dir)}&searchQuery=${encodeURIComponent(`name = "${name.replace(/"/g, '')}"`)}&limit=1`,
			{ headers: { Authorization: auth }, cache: 'no-store' }
		)
		const files = search.ok ? await search.json() : []
		const fileId = Array.isArray(files) ? files[0]?.fileId : undefined
		if (!fileId) continue

		const removed = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
			method: 'DELETE',
			headers: { Authorization: auth }
		})
		if (removed.ok) deleted++
	}

	return NextResponse.json({ deleted })
}
