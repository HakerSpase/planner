import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { DASHBOARD_PAGES } from './config/pages-url.config'

export async function middleware(request: NextRequest) {
	let response = NextResponse.next({
		request: {
			headers: request.headers
		}
	})

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return request.cookies.get(name)?.value
				},
				set(name: string, value: string, options: CookieOptions) {
					request.cookies.set({ name, value, ...options })
					response = NextResponse.next({
						request: {
							headers: request.headers
						}
					})
					response.cookies.set({ name, value, ...options })
				},
				remove(name: string, options: CookieOptions) {
					request.cookies.set({ name, value: '', ...options })
					response = NextResponse.next({
						request: {
							headers: request.headers
						}
					})
					response.cookies.set({ name, value: '', ...options })
				}
			}
		}
	)

	const {
		data: { user }
	} = await supabase.auth.getUser()

	const isAuthPage = request.nextUrl.pathname.startsWith('/auth')

	if (isAuthPage && user) {
		return NextResponse.redirect(new URL(DASHBOARD_PAGES.HOME, request.url))
	}

	if (isAuthPage) {
		return response
	}

	if (!user) {
		return NextResponse.redirect(new URL('/auth', request.url))
	}

	return response
}

export const config = {
	matcher: ['/i/:path*', '/auth/:path*']
}
