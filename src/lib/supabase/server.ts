import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

export function createClient() {
	const cookieStore = cookies()

	return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
		cookies: {
			get(name: string) {
				return cookieStore.get(name)?.value
			},
			set(name: string, value: string, options: CookieOptions) {
				try {
					cookieStore.set({ name, value, ...options })
				} catch (error) {}
			},
			remove(name: string, options: CookieOptions) {
				try {
					cookieStore.set({ name, value: '', ...options })
				} catch (error) {}
			}
		}
	})
}
