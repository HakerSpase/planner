import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/*
 * Заголовок, описание и картинка страницы для карточки ссылки в конспекте.
 * Ответ кэшируется на CDN Vercel на неделю — одна и та же ссылка не грузится повторно.
 */

export const runtime = 'nodejs'

const PRIVATE_HOST =
	/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i

const decode = (value: string) =>
	value
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/\s+/g, ' ')
		.trim()

function meta(html: string, names: string[]) {
	for (const name of names) {
		const pattern = new RegExp(
			`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
			'i'
		)
		const match = pattern.exec(html)
		const value = match?.[1] ?? match?.[2]
		if (value) return decode(value)
	}
	return undefined
}

export async function GET(request: Request) {
	const supabase = createClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

	const raw = new URL(request.url).searchParams.get('url') || ''
	let target: URL
	try {
		target = new URL(raw)
	} catch {
		return NextResponse.json({ error: 'bad url' }, { status: 400 })
	}
	if (!/^https?:$/.test(target.protocol) || PRIVATE_HOST.test(target.hostname))
		return NextResponse.json({ error: 'forbidden' }, { status: 400 })

	try {
		const response = await fetch(target, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; PlannerLinkPreview/1.0; +https://mplanner-dun.vercel.app)',
				Accept: 'text/html,application/xhtml+xml',
				'Accept-Language': 'ru,en;q=0.8'
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(6000)
		})
		if (!response.ok || !(response.headers.get('content-type') || '').includes('html'))
			return NextResponse.json({}, { headers: { 'Cache-Control': 'public, s-maxage=86400' } })

		// Хватит начала страницы — мета-теги в <head>
		const reader = response.body?.getReader()
		let html = ''
		const decoder = new TextDecoder()
		while (reader && html.length < 300_000) {
			const { done, value } = await reader.read()
			if (done) break
			html += decoder.decode(value, { stream: true })
			if (/<\/head>/i.test(html)) break
		}
		reader?.cancel().catch(() => {})

		const image = meta(html, ['og:image', 'twitter:image', 'og:image:url'])
		const result = {
			title: meta(html, ['og:title', 'twitter:title']) || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || ''),
			description: meta(html, ['og:description', 'description', 'twitter:description'])?.slice(0, 300),
			siteName: meta(html, ['og:site_name']),
			image: image ? new URL(image, response.url).href : undefined
		}
		return NextResponse.json(result, {
			headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400' }
		})
	} catch {
		return NextResponse.json({}, { headers: { 'Cache-Control': 'public, s-maxage=3600' } })
	}
}
