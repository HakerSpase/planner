import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
	const requestUrl = new URL(request.url)
	const origin = requestUrl.origin
	const supabase = createClient()

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: 'google',
		options: {
			redirectTo: `${origin}/auth/callback`
		}
	})

	if (error || !data.url) {
		return NextResponse.redirect(`${origin}/auth?error=oauth_failed`)
	}

	return NextResponse.redirect(data.url)
}
