import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const code = requestUrl.searchParams.get('code')
	const cookieValue = request.headers
		.get('cookie')
		?.split(/;\s*/)
		.find(cookie => cookie.startsWith('planner-captcha-oauth='))
		?.slice('planner-captcha-oauth='.length)
	const secret = process.env.TURNSTILE_SECRET_KEY
	const redirect = (path: string) => {
		const response = NextResponse.redirect(new URL(path, requestUrl.origin))
		response.cookies.set('planner-captcha-oauth', '', {
			httpOnly: true,
			secure: requestUrl.protocol === 'https:',
			sameSite: 'lax',
			path: '/auth/callback',
			maxAge: 0
		})
		return response
	}

	if (!code || !cookieValue || !secret) {
		return redirect('/auth?error=captcha_required')
	}

	const separator = cookieValue.lastIndexOf('.')
	const payload = cookieValue.slice(0, separator)
	const suppliedSignature = cookieValue.slice(separator + 1)
	let signatureMatches = false
	try {
		const expectedSignature = createHmac('sha256', secret).update(payload).digest()
		const supplied = Buffer.from(suppliedSignature, 'base64url')
		signatureMatches = supplied.length === expectedSignature.length && timingSafeEqual(supplied, expectedSignature)
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
		return redirect('/auth?error=captcha_required')
	}

	const isFresh = Date.now() - issuedAt >= 0 && Date.now() - issuedAt <= 5 * 60 * 1000
	if (!signatureMatches || !isFresh || !nonce) {
		return redirect('/auth?error=captcha_required')
	}

	const supabase = createClient()
	const { error } = await supabase.auth.exchangeCodeForSession(code)
	if (error) {
		return redirect('/auth?error=oauth_failed')
	}

	return redirect('/i')
}
