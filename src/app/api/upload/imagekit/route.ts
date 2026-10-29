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
