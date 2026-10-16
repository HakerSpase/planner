import { createHmac, randomBytes } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

const CAPTCHA_COOKIE = 'planner-captcha-oauth'
const CAPTCHA_ACTION = 'planner_login'

export async function POST(request: Request) {
	const origin = request.headers.get('origin')
	const requestUrl = new URL(request.url)
	const secret = process.env.TURNSTILE_SECRET_KEY
	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

	if (!secret || !siteKey) {
		return NextResponse.json(
			{ error: 'Проверка безопасности временно недоступна.' },
			{ status: 503 }
		)
	}

	if (!origin || new URL(origin).host !== requestUrl.host) {
		return NextResponse.json({ error: 'Недопустимый источник запроса.' }, { status: 403 })
	}

	const body = await request.json().catch(() => null)
	const token = typeof body?.token === 'string' ? body.token : ''
	if (!token || token.length > 2048) {
		return NextResponse.json({ error: 'Сначала пройдите проверку безопасности.' }, { status: 400 })
	}

	const verificationForm = new URLSearchParams({ secret, response: token })
	const verificationResponse = await fetch(
		'https://challenges.cloudflare.com/turnstile/v0/siteverify',
		{
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: verificationForm,
			cache: 'no-store'
		}
	)

	if (!verificationResponse.ok) {
		return NextResponse.json({ error: 'Не удалось проверить CAPTCHA. Попробуйте ещё раз.' }, { status: 502 })
	}

	const verification = await verificationResponse.json()
	if (
		!verification.success ||
		verification.hostname !== requestUrl.hostname ||
		verification.action !== CAPTCHA_ACTION ||
		verification['error-codes']?.includes('timeout-or-duplicate')
	) {
		return NextResponse.json({ error: 'CAPTCHA не пройдена. Повторите проверку.' }, { status: 403 })
	}

	const forwardedHost = request.headers.get('x-forwarded-host')
	const forwardedProto = request.headers.get('x-forwarded-proto')
	let originUrl = requestUrl.origin
	if (forwardedHost) {
		const proto = forwardedProto || (requestUrl.protocol.startsWith('https') ? 'https' : 'http')
		originUrl = `${proto}://${forwardedHost}`
	}

	const cookiesToSetLater: { name: string; value: string; options: any }[] = []
	const cookieStore = cookies()
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
		cookies: {
			getAll() {
				return cookieStore.getAll()
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(c => {
					try {
						cookieStore.set(c)
					} catch {}
					cookiesToSetLater.push(c)
				})
			}
		}
	})

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: { redirectTo: `${originUrl}/auth/callback` }
	})

	if (error || !data.url) {
		return NextResponse.json({ error: error?.message || 'Не удалось начать вход через Google.' }, { status: 502 })
	}

	const issuedAt = Date.now().toString()
	const nonce = randomBytes(32).toString('base64url')
	const payload = Buffer.from(`${issuedAt}:${nonce}`).toString('base64url')
	const signature = createHmac('sha256', secret).update(payload).digest('base64url')
	const response = NextResponse.json({ url: data.url })

	// Set code verifier cookies directly on the response
	cookiesToSetLater.forEach(({ name, value, options }) => {
		response.cookies.set(name, value, options)
	})

	const isSecure =
		process.env.NODE_ENV === 'production' ||
		requestUrl.protocol === 'https:' ||
		request.headers.get('x-forwarded-proto') === 'https'

	response.cookies.set(CAPTCHA_COOKIE, `${payload}.${signature}`, {
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		path: '/',
		maxAge: 900
	})

	return response
}
