import { NextResponse } from 'next/server'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL ||
	'https://rlnqozoalmzboqypgbcq.supabase.co'

const NATIVE_AUTH_COOKIE = 'planner-native-auth'

/**
 * Старт входа из Android-приложения. Google не пускает в WebView, поэтому вход
 * открывается во вкладке Chrome: здесь помечаем вкладку куки и уводим на Google.
 * На /auth/callback по этой метке код не обменивается, а возвращается в приложение.
 */
export function GET(request: Request) {
	const target = new URL(request.url).searchParams.get('u') || ''
	// Только адрес входа нашего Supabase — никаких открытых редиректов
	if (!target.startsWith(`${SUPABASE_URL}/auth/v1/authorize`)) {
		return NextResponse.json({ error: 'bad_target' }, { status: 400 })
	}
	const response = NextResponse.redirect(target)
	response.cookies.set(NATIVE_AUTH_COOKIE, '1', {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/auth/callback',
		maxAge: 600
	})
	return response
}
