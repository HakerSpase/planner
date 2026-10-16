import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const errorParam = requestUrl.searchParams.get('error')
	const errorDescription = requestUrl.searchParams.get('error_description')

	// Resolve origin accounting for reverse proxies
	const forwardedHost = request.headers.get('x-forwarded-host')
	const forwardedProto = request.headers.get('x-forwarded-proto')
	let origin = requestUrl.origin
	if (forwardedHost) {
		const proto = forwardedProto || (requestUrl.protocol.startsWith('https') ? 'https' : 'http')
		origin = `${proto}://${forwardedHost}`
	}

	const isSecure = origin.startsWith('https:')

	const clearCaptchaCookies = (res: NextResponse) => {
		res.cookies.set('planner-captcha-oauth', '', {
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/',
			maxAge: 0
		})
		res.cookies.set('planner-captcha-oauth', '', {
			httpOnly: true,
			secure: isSecure,
			sameSite: 'lax',
			path: '/auth/callback',
			maxAge: 0
		})
	}

	const redirectWithError = (errorType: string) => {
		const redirectUrl = new URL(`/auth?error=${encodeURIComponent(errorType)}`, origin)
		const res = NextResponse.redirect(redirectUrl)
		clearCaptchaCookies(res)
		return res
	}

	if (errorParam) {
		console.error('OAuth provider returned error:', errorParam, errorDescription)
		return redirectWithError(errorParam)
	}

	if (!code) {
		return redirectWithError('no_code')
	}

	const cookieHeader = request.headers.get('cookie') ?? ''
	const allCookies = parseCookieHeader(cookieHeader)
	const cookieValue = allCookies.find(c => c.name === 'planner-captcha-oauth')?.value
	const secret = process.env.TURNSTILE_SECRET_KEY

	if (secret && cookieValue) {
		const separator = cookieValue.lastIndexOf('.')
		const payload = cookieValue.slice(0, separator)
		const suppliedSignature = cookieValue.slice(separator + 1)
		let signatureMatches = false
		try {
			const expectedSignature = createHmac('sha256', secret).update(payload).digest()
			const supplied = Buffer.from(suppliedSignature, 'base64url')
			signatureMatches =
				supplied.length === expectedSignature.length &&
				timingSafeEqual(supplied, expectedSignature)
		} catch {
			signatureMatches = false
		}

		let issuedAt = 0
		let nonce = ''
		try {
			const decoded = Buffer.from(payload, 'base64url').toString('utf8')
			const separatorIndex = decoded.indexOf(':')
			issuedAt = Number(decoded.slice(0, separatorIndex))
			nonce = decoded.slice(separatorIndex + 1)
		} catch {
			return redirectWithError('captcha_required')
		}

		const isFresh = Date.now() - issuedAt >= 0 && Date.now() - issuedAt <= 15 * 60 * 1000
		if (!signatureMatches || !isFresh || !nonce) {
			return redirectWithError('captcha_required')
		}
	} else if (secret && !cookieValue) {
		console.warn('OAuth callback missing planner-captcha-oauth cookie')
		return redirectWithError('captcha_required')
	}

	// Create redirect response directly to dashboard
	const response = NextResponse.redirect(new URL('/i', origin))

	// Supabase SSR will write session cookies directly onto the response
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get('cookie') ?? '')
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					response.cookies.set(name, value, options)
				})
			}
		}
	})

	const { error } = await supabase.auth.exchangeCodeForSession(code)
	if (error) {
		console.error('exchangeCodeForSession error:', error)
		return redirectWithError('oauth_failed')
	}

	clearCaptchaCookies(response)
	return response
}
