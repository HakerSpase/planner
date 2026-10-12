import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { DASHBOARD_PAGES } from './config/pages-url.config'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

export async function middleware(request: NextRequest) {
	const isAuthPage = request.nextUrl.pathname.startsWith('/auth')

	try {
		let response = NextResponse.next({
			request: {
				headers: request.headers
			}
		})

		const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
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
		})

		const {
			data: { user }
		} = await supabase.auth.getUser()

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
	} catch (error) {
		// В случае непредвиденной ошибки в middleware отдаем страницу дальше
		console.error('Middleware error:', error)
		if (isAuthPage) {
			return NextResponse.next()
		}
		return NextResponse.redirect(new URL('/auth', request.url))
	}
}

export const config = {
	matcher: ['/i/:path*', '/auth/:path*']
}
