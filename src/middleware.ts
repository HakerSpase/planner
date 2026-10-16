import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

import { DASHBOARD_PAGES } from './config/pages-url.config'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

export async function middleware(request: NextRequest) {
	const pathname = request.nextUrl.pathname

	// Allow auth callback route handler to execute directly without middleware interference
	if (pathname.startsWith('/auth/callback')) {
		return NextResponse.next()
	}

	const isAuthPage = pathname.startsWith('/auth')

	try {
		let supabaseResponse = NextResponse.next({
			request: {
				headers: request.headers
			}
		})

		const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
			cookies: {
				getAll() {
					return request.cookies.getAll()
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
					supabaseResponse = NextResponse.next({
						request: {
							headers: request.headers
						}
					})
					cookiesToSet.forEach(({ name, value, options }) =>
						supabaseResponse.cookies.set(name, value, options)
					)
				}
			}
		})

		const {
			data: { user }
		} = await supabase.auth.getUser()

		if (isAuthPage && user) {
			const redirectResponse = NextResponse.redirect(new URL(DASHBOARD_PAGES.HOME, request.url))
			supabaseResponse.cookies.getAll().forEach(cookie => {
				redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
			})
			return redirectResponse
		}

		if (isAuthPage) {
			return supabaseResponse
		}

		if (!user) {
			const redirectResponse = NextResponse.redirect(new URL('/auth', request.url))
			supabaseResponse.cookies.getAll().forEach(cookie => {
				redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
			})
			return redirectResponse
		}

		return supabaseResponse
	} catch (error) {
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
