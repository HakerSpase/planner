import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL =
	process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
const SUPABASE_KEY =
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsbnFvem9hbG16Ym9xeXBnYmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTA0NjYsImV4cCI6MjEwNzM4NjQ2Nn0.qSGsOjQwouqFjHlXq8au1zq5RIT-pYD32Vnw5r-MoPA'

export function createClient() {
	return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
